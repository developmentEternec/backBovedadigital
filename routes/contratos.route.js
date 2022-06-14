const { Router } = require('express');

// Importar validaciones de JWT
const { validarJWT } = require('../middlewares/validar-jwt');

// Importar controladores
const { ctrl_crear, ctrl_eliminar, ctrl_infoContrato, ctrl_lista, ctrl_buscar, ctrl_actualizar, ctrl_actualizar_partida, ctrl_eliminar_partida, ctrl_lista_partidas, ctrl_crear_partida } = require('../controllers/contratos.controller');

const router = Router();

/* *** Crear contrato *** */
router.post('/crear/:rfc', validarJWT, ctrl_crear);

/* *** Actualizar contrato *** */
router.patch('/actualizar/:rfc/:idContrato', validarJWT, ctrl_actualizar);

/* *** Eliminar contrato *** */
router.patch('/eliminar/:rfc/:idContrato/:user', validarJWT, ctrl_eliminar);

/* *** Consultar contrato *** */
router.get('/infoContrato/:rfc/:idContrato', validarJWT, ctrl_infoContrato);

/* *** Lista contratos *** */
router.get('/lista/:rfc', validarJWT, ctrl_lista);

/* *** Buscar *** */
router.post('/buscar/:rfc', validarJWT, ctrl_buscar);

/* *** Actualizar partida *** */
router.patch('/actualizarPartida/:rfc/:idContrato/:posnr', validarJWT, ctrl_actualizar_partida);

/* *** Eliminar partida *** */
router.delete('/eliminarPartida/:rfc/:idContrato/:posnr', validarJWT, ctrl_eliminar_partida);

/* *** Lista partidas por contrato *** */
router.get('/listaPartidas/:rfc/:idContrato', validarJWT, ctrl_lista_partidas);

/* * Crear partida en contrato * */
router.post('/crearPartida/:rfc/:idContrato', validarJWT, ctrl_crear_partida);

/* **** Exportar módulo **** */
module.exports = router;