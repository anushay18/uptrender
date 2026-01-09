import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  getAllTickets,
  getTicketById,
  updateTicket,
  replyToTicket,
  deleteTicket,
  getTicketStats
} from '../controllers/adminSupportController.js';

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/', getAllTickets);
router.get('/stats', getTicketStats);
router.get('/:id', getTicketById);
router.put('/:id', updateTicket);
router.post('/:id/reply', replyToTicket);
router.delete('/:id', deleteTicket);

export default router;
