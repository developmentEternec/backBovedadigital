const { Router } = require('express');
const { ctrl_infoDominios } = require('../controllers/utilerias.controller');
const router = Router();
const { validarJWT } = require('../middlewares/validar-jwt');

/* *** Obtener información de dominio *** */
router.get('/infoDM/:rfc/:dmName', validarJWT, ctrl_infoDominios);

/* **** Exportar módulo **** */
module.exports = router;