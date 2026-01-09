import { SupportTicket, SupportMessage, User, Notification } from '../models/index.js';
import { Op } from 'sequelize';
import { emitTicketUpdate, emitToUser, emitNotification } from '../config/socket.js';

// Get user's tickets
export const getUserTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, priority, category, page = 1, limit = 10 } = req.query;

    const where = { userId };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;

    const offset = (page - 1) * limit;

    const tickets = await SupportTicket.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: SupportMessage,
          as: 'messages',
          limit: 1,
          order: [['createdAt', 'DESC']],
          include: [
            {
              model: User,
              as: 'author',
              attributes: ['id', 'name', 'username']
            }
          ]
        }
      ]
    });

    res.json({
      success: true,
      data: tickets.rows,
      pagination: {
        total: tickets.count,
        page: parseInt(page),
        pages: Math.ceil(tickets.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
};

// Create ticket
export const createTicket = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject, category, priority, description, attachments } = req.body;

    // Generate unique ticket number (max 20 chars)
    const ticketNumber = `TKT${Date.now().toString(36).toUpperCase()}`;

    const ticket = await SupportTicket.create({
      ticketNumber,
      userId,
      subject,
      category: category || 'General',
      priority: priority || 'medium',
      status: 'open',
      description
    });

    // Create first message
    if (description) {
      await SupportMessage.create({
        ticketId: ticket.id,
        authorId: userId,
        message: description,
        attachments: attachments || []
      });
    }

    // Get full ticket with messages
    const fullTicket = await SupportTicket.findByPk(ticket.id, {
      include: [
        {
          model: SupportMessage,
          as: 'messages',
          include: [
            {
              model: User,
              as: 'author',
              attributes: ['id', 'name', 'username']
            }
          ]
        }
      ]
    });

    // Emit real-time notification to user
    emitToUser(userId, 'ticket:created', fullTicket);

    // Create confirmation notification
    const notification = await Notification.create({
      userId,
      type: 'support',
      title: 'Support Ticket Created',
      message: `Your support ticket "${subject}" (#${ticketNumber}) has been submitted. Our team will respond soon.`,
      metadata: {
        ticketId: ticket.id,
        ticketNumber: ticketNumber,
        link: '/user/support'
      },
      isRead: false
    });
    emitNotification(userId, notification);

    res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      data: fullTicket
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
};

// Get ticket by ID
export const getTicketById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const ticket = await SupportTicket.findOne({
      where: { id, userId },
      include: [
        {
          model: SupportMessage,
          as: 'messages',
          order: [['createdAt', 'ASC']],
          include: [
            {
              model: User,
              as: 'author',
              attributes: ['id', 'name', 'username', 'role']
            }
          ]
        },
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'name', 'username']
        }
      ]
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
};

// Add message to ticket
export const addMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { message, attachments } = req.body;

    const ticket = await SupportTicket.findOne({
      where: { id, userId }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.status === 'Closed') {
      return res.status(400).json({ error: 'Cannot add message to closed ticket' });
    }

    const newMessage = await SupportMessage.create({
      ticketId: id,
      authorId: userId,
      message,
      attachments: attachments || []
    });

    // Update ticket status if it was resolved
    if (ticket.status === 'Resolved') {
      await ticket.update({ status: 'Open' });
    }

    // Get message with author details
    const fullMessage = await SupportMessage.findByPk(newMessage.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'name', 'username']
        }
      ]
    });

    // Emit real-time update to ticket room
    emitTicketUpdate(id, { message: fullMessage, ticket }, 'message');

    res.status(201).json({
      success: true,
      message: 'Message added successfully',
      data: fullMessage
    });
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
};

// Close ticket
export const closeTicket = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const ticket = await SupportTicket.findOne({
      where: { id, userId }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    await ticket.update({ status: 'Closed' });

    res.json({
      success: true,
      message: 'Ticket closed successfully',
      data: ticket
    });
  } catch (error) {
    console.error('Close ticket error:', error);
    res.status(500).json({ error: 'Failed to close ticket' });
  }
};

// Admin: Get all tickets
export const getAllTickets = async (req, res) => {
  try {
    const { status, priority, category, page = 1, limit = 20, search } = req.query;

    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (search) {
      where[Op.or] = [
        { ticketNumber: { [Op.like]: `%${search}%` } },
        { subject: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    const tickets = await SupportTicket.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'username']
        },
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'name', 'username']
        },
        {
          model: SupportMessage,
          as: 'messages',
          limit: 1,
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    res.json({
      success: true,
      data: tickets.rows,
      pagination: {
        total: tickets.count,
        page: parseInt(page),
        pages: Math.ceil(tickets.count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
};

// Admin: Assign ticket
export const assignTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    const ticket = await SupportTicket.findByPk(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Verify assigned user exists
    if (assignedTo) {
      const user = await User.findByPk(assignedTo);
      if (!user) {
        return res.status(404).json({ error: 'Assigned user not found' });
      }
    }

    await ticket.update({
      assignedTo,
      status: assignedTo ? 'In Progress' : ticket.status
    });

    const fullTicket = await SupportTicket.findByPk(id, {
      include: [
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'name', 'username']
        }
      ]
    });

    res.json({
      success: true,
      message: 'Ticket assigned successfully',
      data: fullTicket
    });
  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({ error: 'Failed to assign ticket' });
  }
};

// Admin: Update ticket status
export const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority } = req.body;

    const ticket = await SupportTicket.findByPk(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;

    await ticket.update(updateData);

    res.json({
      success: true,
      message: 'Ticket updated successfully',
      data: ticket
    });
  } catch (error) {
    console.error('Update ticket status error:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
};

// Admin: Add admin reply
export const addAdminReply = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { id } = req.params;
    const { message, attachments } = req.body;

    const ticket = await SupportTicket.findByPk(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const newMessage = await SupportMessage.create({
      ticketId: id,
      authorId: adminId,
      message,
      attachments: attachments || []
    });

    // Update ticket status
    await ticket.update({ 
      status: 'In Progress',
      assignedTo: adminId
    });

    // Get message with author details
    const fullMessage = await SupportMessage.findByPk(newMessage.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'name', 'username', 'role']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Reply added successfully',
      data: fullMessage
    });
  } catch (error) {
    console.error('Add admin reply error:', error);
    res.status(500).json({ error: 'Failed to add reply' });
  }
};
