import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { roleCheck } from '../middleware/roleCheck.js';
import { 
  getUserTickets, 
  createTicket, 
  getTicketById, 
  addMessage, 
  closeTicket,
  getAllTickets,
  assignTicket,
  updateTicketStatus,
  addAdminReply
} from '../controllers/supportController.js';
import { 
  createTicketValidation, 
  addMessageValidation, 
  idParamValidation,
  paginationValidation
} from '../middleware/validation.js';

const router = express.Router();

// User support routes
router.get('/', authenticate, paginationValidation, getUserTickets);
router.post('/', authenticate, createTicketValidation, createTicket);
router.get('/:id', authenticate, idParamValidation, getTicketById);
router.post('/:id/message', authenticate, addMessageValidation, addMessage);
router.post('/:id/close', authenticate, idParamValidation, closeTicket);

// Admin routes
router.get('/admin/all', authenticate, roleCheck(['Admin', 'Manager']), paginationValidation, getAllTickets);
router.post('/admin/:id/assign', authenticate, roleCheck(['Admin', 'Manager']), idParamValidation, assignTicket);
router.put('/admin/:id/status', authenticate, roleCheck(['Admin', 'Manager']), idParamValidation, updateTicketStatus);
router.post('/admin/:id/reply', authenticate, roleCheck(['Admin', 'Manager']), idParamValidation, addMessageValidation, addAdminReply);

export default router;
