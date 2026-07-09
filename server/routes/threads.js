const express = require('express');
const requireAuth = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { getThread, postMessage, postAttachment } = require('../controllers/threadController');

const router = express.Router();
router.use(requireAuth);

router.get('/:dsrNo', getThread);
router.post('/:dsrNo/messages', postMessage);
router.post('/:dsrNo/attachment', upload.single('file'), postAttachment);

module.exports = router;
