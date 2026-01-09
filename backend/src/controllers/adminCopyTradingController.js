import { CopyTradingAccount, User } from '../models/index.js';
import { Op } from 'sequelize';

// Get all copy trading users with their accounts (Admin)
export const getAllCopyTradingUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      type, // filter by account type: master/child
      isActive, // filter by active status
      sort = '-createdAt',
    } = req.query;

    const offset = (page - 1) * limit;

    // Build where clause for accounts
    const accountWhere = {};
    if (type) accountWhere.type = type;
    if (typeof isActive !== 'undefined') accountWhere.isActive = String(isActive) === 'true';

    // Sorting
    const order = [];
    if (sort) {
      if (sort.startsWith('-')) {
        order.push([sort.slice(1), 'DESC']);
      } else {
        order.push([sort, 'ASC']);
      }
    } else {
      order.push(['createdAt', 'DESC']);
    }

    // Build include for user and optional search
    const userInclude = {
      model: User,
      as: 'owner',
      attributes: ['id', 'name', 'username', 'email', 'role', 'status'],
      where: undefined,
    };

    if (search) {
      userInclude.where = {
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { username: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
        ],
      };
    }

    const accounts = await CopyTradingAccount.findAndCountAll({
      where: accountWhere,
      limit: parseInt(limit),
      offset,
      order,
      attributes: [
        'id',
        'userId',
        'name',
        'type',
        'broker',
        'isActive',
        'masterAccountId',
        'createdAt',
        'updatedAt',
      ],
      include: [userInclude],
    });

    // Enrich with master account names and basic grouping key
    const rows = await Promise.all(
      accounts.rows.map(async (acc) => {
        const data = acc.toJSON();
        let masterAccountName = null;
        if (data.type === 'child' && data.masterAccountId) {
          const master = await CopyTradingAccount.findByPk(data.masterAccountId, {
            attributes: ['name'],
          });
          masterAccountName = master ? master.name : null;
        }
        return {
          id: data.id,
          name: data.name,
          type: data.type,
          broker: data.broker,
          isActive: data.isActive,
          masterAccountId: data.masterAccountId,
          masterAccountName,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          user: data.owner,
        };
      })
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: accounts.count,
        page: parseInt(page),
        pages: Math.ceil(accounts.count / limit),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Admin get copy trading users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch copy trading users',
    });
  }
};
