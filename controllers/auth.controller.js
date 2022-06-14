//Dependencies anda package of NodeJS
const admin = require("firebase-admin");
const { Storage } = require('@google-cloud/storage');
const path = require("path");
const { request, response } = require('express');
const bcryptjs = require('bcryptjs');
const { generarJWT } = require('../helpers/generar-jwt');
const jwt = require('jsonwebtoken');

// Instancia de la BD
dbUsersHdr = admin.firestore();
dbUsersDet = admin.firestore();

// Nombre de colección en Firestore
dbNameUsersHdr = "UsuariosHdr";
dbNameUsersDet = "UsuariosDet";

// Instancia de Storage c/key de acceso
const storage = new Storage({ keyFilename: 'key.json' });

// Nombre del bucket en GCP
const bucketNameGCP = process.env.BUCKETNAME;

// Instancia bucket GCP
const bucket = storage.bucket(bucketNameGCP);

// **** Creación de nuevo usuario ****
const ctrl_create = async (pi_req = request, pe_res = response) => {
    db = admin.firestore();
    try {

        const { email, password, rfc } = pi_req.body;
        const usuario = { email, password };

        // Obtener datos del usuario
        const datosRef = db.collection(dbNameUsersHdr);
        const snapshot = await datosRef.where('email', '==', `${email}`).get();

        let get_usuario, get_id, get_password;
        snapshot.forEach(doc => {
            get_id = doc.id
            get_usuario = doc.data().email
            get_password = doc.data().password
        });

        if (get_usuario) {
            return pe_res.status(400).json({ e_subrc: 4, msg: 'El usuario ya existe con ese email' });
        } else {
            // Encriptación de contraseña
            const salt = bcryptjs.genSaltSync();
            usuario.password = bcryptjs.hashSync(password, salt);

            // Generate Json Web Token JWT
            const token = await generarJWT(get_id);

            // Creación de usuario HDR en Firestore
            const userHDR = await db.collection(dbNameUsersHdr).add(usuario);
            // Creación de rama Sociedades
            await db.collection(dbNameUsersDet).doc(`${userHDR.id}`).set({});
            // Creación de usuario DET en Firestore (Sociedad)
            await db.collection(dbNameUsersDet).doc(`${userHDR.id}`).collection('SOCIEDADES').doc(`${rfc}`).set({
                estatus: '01' // Activo
            });

            //Path in bucket storage
            const filePath = path.resolve(__dirname, `../archivo.txt`);

            await bucket.upload(filePath, {
                destination: `${rfc}`,
            });
           
            pe_res.status(200).json({ e_subrc: 0, usuario, msg: 'Alta de usuario exitosa.', token });
        }
    } catch (error) {
        console.log(error)
        pe_res.status(400).json({ e_subrc: 4, msg: 'Algo salió mal, contactar al administrador.', error });
    }

}

// **** Login ****
const ctrl_login = async (pi_req = request, pe_res = response) => {
    // Referencia a Firebase
    db = admin.firestore();

    try {
        // Extracción de datos del cuerpo de la petición
        const { email, password } = pi_req.body;

        const datosRef = db.collection(dbNameUsersHdr);
        const snapshot = await datosRef.where('email', '==', `${email}`).get();

        let get_id, get_correo, get_password;

        snapshot.forEach(doc => { get_id = doc.id; get_correo = doc.data().email; get_password = doc.data().password; });

        // Validar email
        if (!get_correo) {
            return pe_res.status(400).json({ e_subrc: 4, msg: 'Credenciales no válidas - correo' });
        }


        // Validar contraseña  
        const validPassword = bcryptjs.compareSync(password, get_password);
        if (!validPassword) {
            return pe_res.status(400).json({ e_subrc: 4, msg: 'Credenciales no válidas - contraseña incorrecta.' })
        }

        // Generar JWT
        const token = await generarJWT(get_id);

        // Obtener lista de sociedades
        const snapshotSoc = await dbUsersDet.collection(dbNameUsersDet)
                                    .doc(`${get_id}`)
                                    .collection('SOCIEDADES').get();
        let sociedades = snapshotSoc.docs.map((doc) => {
            return doc.id;
        })

        pe_res.status(200).json({ e_subrc: 0, token, msg: 'Autenticado correctamente.', sociedades });
    } catch (error) {
        return pe_res.status(400).json({ e_subrc: 4, msg: 'Algo salió mal, contactar con el administrador.' });
    }

}

// **** Renovación de JWT ****
const ctrl_renewToken = async (pi_req = request, pe_res = response) => {
    const { uid } = pi_req;

    // Generar el JWT
    const token = await generarJWT(uid);

    return pe_res.status(200).json({ e_subrc: true, uid, token });
}

module.exports = { ctrl_create, ctrl_login, ctrl_renewToken }