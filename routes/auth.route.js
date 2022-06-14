// Depnendices
const { Router } = require('express');
const { check } = require('express-validator');
const router = Router();
const { ctrl_create, ctrl_login, ctrl_renewToken } = require('../controllers/auth.controller');
const { validarCampos } = require('../middlewares/validar-campos');
const { validarJWT } = require('../middlewares/validar-jwt');


// Crear usuario
router.post('/crear', [
    check('email', 'El correo es obligatorio').isEmail(),
    check('password', 'La contraseña es obligatoria').not().isEmpty(),
],  ctrl_create);

// Login
router.post('/login',[
    check('email', 'El correo es obligatorio').isEmail(),
    check('password', 'La contraseña es obligatoria').not().isEmpty(),
    validarCampos
] , ctrl_login);


//Validar y renovar token
router.get( '/renovar', validarJWT , ctrl_renewToken );


module.exports = router