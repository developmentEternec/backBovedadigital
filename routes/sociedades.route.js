const { Router } = require('express');

// Importar validaciones de JWT
const { validarJWT } = require('../middlewares/validar-jwt');

// Importar controladores
const { ctrl_lista, ctrl_infoSociedad, ctrl_crear, ctrl_actualizar, ctrl_eliminar, ctrl_buscar } = require('../controllers/sociedades.controller');

const router = Router();

/* *** Obtener lista de sociedades *** */
router.get('/lista', validarJWT, ctrl_lista);

/* *** Obtener información de sociedad *** */
router.get('/infoSociedad/:rfc', validarJWT, ctrl_infoSociedad);

/* *** Búsqueda *** */
router.post('/buscar', validarJWT, ctrl_buscar);

/* *** Crear nueva sociedad *** */
router.post('/crear', validarJWT, ctrl_crear);

/* *** Actualizar sociedad *** */
router.patch('/actualizar/:rfc', validarJWT, ctrl_actualizar);

/* *** Eliminar sociedad *** */
router.delete('/eliminar/:rfc', validarJWT, ctrl_eliminar);

/* **** Exportar módulo **** */
module.exports = router;