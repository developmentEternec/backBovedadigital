const { Router } = require('express');
const router = Router();
const { ctrl_carga, ctrl_lista, ctrl_eliminar, ctrl_buscar, ctrl_descarga, ctrl_info_fact,ctrl_validar} = require('../controllers/facturas.controllers');
const { multer } = require('../middlewares/multer');
const { validarJWT } = require('../middlewares/validar-jwt');

/* *** Carga de facturas *** */
router.post('/cargar/:rfc', [validarJWT, multer.array('file')],  ctrl_carga);

/* *** Lista contratos *** */
router.get('/lista/:rfc', validarJWT, ctrl_lista);

/* *** Eliminar contrato *** */
router.patch('/eliminar/:rfc/:user/:uuid', validarJWT, ctrl_eliminar);

/* *** Lista contratos *** */
router.post('/buscar/:rfc', validarJWT, ctrl_buscar);

/* *** Descargar archivos *** */
router.get('/descargar/:rfc/:tFactura/:year/:month/:uuid', validarJWT, ctrl_descarga);

/* *** Info factura *** */
router.get('/info/:rfc/:uuid', validarJWT, ctrl_info_fact);

/* * Validar facturas (pre-carga) * */
router.post('/validar/:rfc', [validarJWT, multer.array('file')],  ctrl_validar);

module.exports = router;
