const { Router } = require('express');

// Importar validaciones de JWT
const { validarJWT } = require('../middlewares/validar-jwt');
const { multer } = require('../middlewares/multer');

// Importar controladores
const { ctrl_lista, ctrl_infoProv, ctrl_crear, ctrl_actualizar, ctrl_eliminar, ctrl_buscar, ctrl_down, ctrl_deleteFile, ctrl_fileProv} = require('../controllers/proveedores.controller');

const router = Router();

/* *** Obtener lista de proveedores *** */
router.get('/lista/:rfcSociedad', validarJWT, ctrl_lista);

/* *** Obtener información de proveedor *** */
router.get('/infoProveedor/:rfcSociedad/:rfc', validarJWT, ctrl_infoProv);

/* *** Búsqueda *** */
router.post('/buscar/:rfcSociedad', validarJWT, ctrl_buscar);

/* *** Crear nuevo proveedor *** */
router.post('/crear/:rfcSociedad', validarJWT, ctrl_crear);

// INI: EAC 03.03.2022 Permitir carga de archivos al proveedor
/* * Actualizar proveedor * */
router.post('/actualizar/:rfcSociedad/:rfc/:user', [validarJWT, multer.array('file')], ctrl_actualizar);
// FIN EAC 03.03.2022

// INI: EAC 29.03.2022 Descargar evidencias del Proveedor
/* * Descarga  de evidencias * */
// router.get('/down/:rfc/:rfcProv/:category', validarJWT, ctrl_down);
router.get('/down/:rfc/:rfcProv/:category/:archivo', validarJWT, ctrl_down);
// FIN EAC: 29.03.2022

//INI: EAC 14.03.2022 Eliminar archivos de proveedor
router.delete('/deleteFile/:rfcSociedad/:rfcProv/:category/:archivo', validarJWT, ctrl_deleteFile)
//FIN: EAC 14.03.2022

/* *** Eliminar proveedor *** */
router.delete('/eliminar/:rfcSociedad/:rfc', validarJWT, ctrl_eliminar);

/* **** Exportar módulo **** */
module.exports = router;