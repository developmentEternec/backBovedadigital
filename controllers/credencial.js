//Dependencies anda package of NodeJS
const admin = require("firebase-admin");
const { Storage } = require('@google-cloud/storage');
const path = require("path");
const { request, response } = require('express');
const bcryptjs = require('bcryptjs');
const { generarJWT } = require('../helpers/generar-jwt');
const jwt = require('jsonwebtoken');


module.exports = { }