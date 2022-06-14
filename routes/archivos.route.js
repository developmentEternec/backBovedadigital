const { Router } = require('express');
const router = Router();
const { ctrl_carga, ctrl_lista, ctrl_down, ctrl_lista_gral, ctrl_deleteFile, ctrl_deleteFileContract} = require('../controllers/archivos.controller');
const { multer } = require('../middlewares/multer');
const { validarJWT } = require('../middlewares/validar-jwt');



/* *** Carga de evidencias *** */
router.post('/carga/:rfc/:col/:id/:usuario', [validarJWT, multer.array('file')], ctrl_carga);

/* *** Lista  de archivos contrato *** */
router.get('/lista/:rfc/:col/:id', validarJWT, ctrl_lista);


/* *** Lista  de evidencias general *** */
router.get('/lista/:rfc/:id', validarJWT, ctrl_lista_gral);

/* *** Descarga  de evidencias *** */
// router.get('/down/:rfc/:col/:id/:archivo', validarJWT, ctrl_down);
/* * Descarga  de evidencias * */
router.get('/down/:rfc/:col/:uuid/:category/:archivo', validarJWT, ctrl_down);

//INI: EAC 30.03.2022 Eliminar archivos de cfdi
router.delete('/deleteFile/:rfcSociedad/:sub/:uuid/:category/:archivo', validarJWT, ctrl_deleteFile)
//FIN: EAC 30.03.2022

//INI: SHV 12.04.2022 Eliminar archivos de contratos
router.delete('/deleteFileContract/:rfcSociedad/:sub/:idContrato/:category/:archivo', validarJWT, ctrl_deleteFileContract)
//FIN: SHV 12.04.2022

module.exports = router;