const express = require('express');
const requireAuth = require('../middlewares/auth');
const { unreadCount, list, markRead, markAllRead, threadUnreadCounts, markThreadRead } = require('../controllers/notificationController');

const router = express.Router();
router.use(requireAuth);

router.get('/count', unreadCount);
router.get('/thread-unread', threadUnreadCounts);
router.patch('/thread-read/:dsrNo', markThreadRead);
router.get('/', list);
router.patch('/:id/read', markRead);
router.patch('/read-all', markAllRead);

module.exports = router;
