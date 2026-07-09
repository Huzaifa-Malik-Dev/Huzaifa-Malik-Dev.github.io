const express = require('express');
const requireAuth = require('../middlewares/auth');
const { requireModule } = require('../middlewares/rbac');
const { list, create, update, remove } = require('../controllers/productController');

const router = express.Router();
router.use(requireAuth, requireModule('products'));

router.get('/', list);
router.post('/', requireModule('products', { edit: true }), create);
router.patch('/:id', requireModule('products', { edit: true }), update);
router.delete('/:id', requireModule('products', { edit: true }), remove);

module.exports = router;
