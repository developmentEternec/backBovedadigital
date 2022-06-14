// Depnendices
const { Router } = require('express');
const { check } = require('express-validator');
const router = Router();
const { validarJWT } = require('../middlewares/validar-jwt');



module.exports = router