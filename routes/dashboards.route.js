const { Router } = require('express');
const router = Router();
const { ctrl_info_prov } = require('../controllers/dashboards.controller');
const { validarJWT } = require('../middlewares/validar-jwt');

/* *** Obtener información dashboards proveedores *** */
router.get('/proveedores/:rfc', validarJWT, ctrl_info_prov);

module.exports = router;