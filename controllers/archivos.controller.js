const { response, request } = require('express');
const { Storage } = require('@google-cloud/storage');
const admin = require("firebase-admin");

/* FireSQL */
const { FireSQL } = require('FireSQL');

const storage = new Storage({ keyFilename: 'key.json' });
const dbFormatFiles = 'FORMATOS';

const subFiles = 'ARCHIVOS';
const subContracts = 'CONTRATOS';
const subFacts = 'FACTURAS';

const subPhotos = 'FOTOS';
const subDocuments = 'DOCUMENTOS';
const subVideos = 'VIDEOS';
const subAudio = 'AUDIO'
const subOthers = 'OTROS'

// Nombre del bucket
const bucketNameGCP = process.env.BUCKETNAME;

// Instancia del bucket
const bucket = storage.bucket(bucketNameGCP);

/* *** Carga de archivos *** */
const ctrl_carga = async (pi_req = request, pe_res = response) => {
    // Referencia a Firebase
    db = admin.firestore();

    // Parámetros
    const rfc = pi_req.params.rfc;
    const subToUpload = pi_req.params.col;
    const id = pi_req.params.id;
    const files = pi_req.files;
    let collection = '';
    let lv_subrc = 0;
    let msgPool = [];
    const { usuario } = pi_req.params;

    // Validar en que subcolección se guarda la respectiva evidencia
    if (subToUpload === 'C') { // Contratos
        collection = subContracts;
        // Validar que el contrato exista en BD
        lv_subrc = await checkIdContratoExist(rfc, id);
        if (lv_subrc != 0) {
            return pe_res.status(400).json({
                e_subrc: 4,
                msg: `El ID de contrato: ${id} no existe en BD.`
            });
        }
    } else if (subToUpload === 'F') { // Facturas
        collection = subFacts;
        // Validar que el UUID exista en BD
        lv_subrc = await checkUuidExist(rfc, id);
        if (lv_subrc != 0) {
            return pe_res.status(400).json({
                e_subrc: 4,
                msg: `El UUID: ${id} no existe en BD.`
            });
        }
    } else {
        return pe_res.status(400).json({
            e_subrc: 4,
            msg: `Parámetro en URL "${subToUpload}" no soportado.`
        });
    }

    // Validar que se hayan enviado archivos en el request
    if (!files || files.length == 0) {
        return pe_res.status(400).json({
            e_subrc: 4,
            msg: "No hay archivos para cargar."
        });
    }

    // Obtener listas de formatos de archivos
    // Fotos
    const formatPhotos = await getFormat(subPhotos);
    // Documentos
    const formatDocuments = await getFormat(subDocuments);
    // Audio
    const formatAudio = await getFormat(subAudio);
    // Vídeos
    const formatVideos = await getFormat(subVideos);

    // Recorremos la lista de archivos a cargar
    await files.forEach(async (file, msg) => {

        // Validamos la extensión
        const nameType = file.originalname.split('.');
        const category = getCategory(formatPhotos, formatVideos, formatAudio, formatDocuments, nameType[1]);

        try {
            // Grabar en BD
            await db.collection(rfc).doc(subFiles).set({});
            // Validar si ya existe lel documento
            const snapShot = await db.collection(rfc).doc(subFiles).collection(collection).doc(id).get();
            if (!snapShot.exists) { // Se crea el campo de tipo array para guardar los id de colecciones que se vayan creando
                await db.collection(rfc).doc(subFiles).collection(collection).doc(id).set({ listCollectionIds: [category] });
            } else { // Se actualiza el campo de tipo array realizando una unión de los id de colecciones
                await db.collection(rfc).doc(subFiles).collection(collection).doc(id).update({ listCollectionIds: admin.firestore.FieldValue.arrayUnion(category) });

            }

            let fechaHoy     = fechaCargaEvidencia();
            let formatoHora  = horaCargaEvidencia();
            let nameFile = file.originalname.split('.')
            let nameOriginal = `${nameFile[0]}${fechaHoy}${formatoHora}.${nameFile[1]}`
            console.log(nameOriginal);


            // Grabar nombre de archivo y fecha de carga
            await db.collection(rfc).doc(subFiles).collection(collection).doc(id).collection(category).doc().set({
                archivo: nameOriginal,
                horaCarga: gethoraCarga(),
                fechaCarga: getfechaCarga(),
                usuario: usuario
            });

            // Cargar archivo a Cloud storage
            msg = await uploadFile(file.buffer, rfc, nameOriginal, file.mimetype, collection, id, category, bucketNameGCP);
            console.log(msg)
            msgPool.push(msg)
        } catch (error) {
            // Enviar mensaje de carga erronea
            msg = {
                e_subrc: 4,
                msg: `Error al cargar el archivo: ${nameOriginal} - ${error}`
            };
        }
        return msg;
    });

    pe_res.status(200).json({
        e_subrc: 0,
        msg: msgPool
    });

}

/* *** Lista de archivos *** */
const ctrl_lista = async (pi_req = request, pe_res = response) => {
    // Referencia a Firebase
    db = admin.firestore();

    // Parámetros
    const rfc = pi_req.params.rfc;
    const subToUpload = pi_req.params.col;
    const id = pi_req.params.id;
    let collection = getCol(subToUpload);

    if (collection === 'N/A') {
        return pe_res.status(400).json({
            e_subrc: 4,
            msg: `Parámetro en URL "${subToUpload}" no soportado.`
        });
    }

    // Obtener lista de id de colecciones pertenecientes al contrato/factura ingresado
    const text1 = (collection === subContracts) ? 'contrato' : 'factura';
    const snapShot = await db.collection(rfc).doc(subFiles).collection(collection).doc(id).get();
    console.log(snapShot.data())
    if (!snapShot.exists) {
        return pe_res.status(400).json({
            e_subrc: 4,
            msg: `El ${text1} no tiene archivos cargados.`
        });
    }

    const listA = snapShot.data().listCollectionIds;
    let COLECCIONES = await getList(listA, rfc, collection, id);
    return pe_res.status(200).json({
        e_subrc: 0,
        COLECCIONES
    });

}

const ctrl_lista_gral = async (pi_req = request, pe_res = response) => {
    // Referencia a Firebase
    db = admin.firestore();

    // Parámetros
    const rfc = pi_req.params.rfc;
    const id = pi_req.params.id;

    const snapShot = await db.collection(rfc).doc(subFiles).collection('CONTRATOS').doc(id).get();
    const snapShotFact = await db.collection(rfc).doc(subFiles).collection('FACTURAS').doc(id).get();


    // console.log(snapShot.data())
    if (snapShot.data() != undefined) {
        //Lista del CONTRATO
        const listA = snapShot.data().listCollectionIds;
        let COLECCIONESCONTRACT = await getListContracts(listA, rfc, '', id);

        //Lista de la factura
        const listB = snapShotFact.data().listCollectionIds;
        let COLLECCIONESFACTS = await getListFacts(listB, rfc, '', id)

        return pe_res.status(200).json({
            e_subrc: 0,
            COLECCIONESCONTRACT,
            COLLECCIONESFACTS
        });
    } else {

        let COLECCIONESCONTRACT = {}
        let COLLECCIONESFACTS = {}


        try {
            console.log('EJECUTANDO TRY')
            //Lista de la factura
            const listB = snapShotFact.data().listCollectionIds;
            COLLECCIONESFACTS = await getListFacts(listB, rfc, '', id)
        }
        catch (error) {
            console.log(error)
            return pe_res.status(200).json({
                e_subrc: 0,
                COLECCIONESCONTRACT

            });
        }
        return pe_res.status(200).json({
            e_subrc: 0,
            COLECCIONESCONTRACT,
            COLLECCIONESFACTS
        });
    }






}

//Descarga de evidencias
const ctrl_down = async (pi_req = request, pe_res = response) => {
    // Referencia a Firebase
    db = admin.firestore();
    const { uuid, category, archivo } = pi_req.params;

    // Instancias para obtención de URL de archivos
    const storageFOTO = new Storage();
    const storageDOCS = new Storage();


    // Nombre de los archivos
    let fileNameDOC = [];

    // Endpoints para acceso a los archivos
    let endpointFOTO = '';
    let endpointDOC = '';
    let endpoint = [];


    // Nombre del bucket
    let bucketName = process.env.BUCKETNAME;

    const { rfc, id } = pi_req.params;
    const subToUpload = pi_req.params.col;
    let collection = '';
    let categorys = pi_req.params.category.toUpperCase();
    // let fotos = 'DOCUMENTOS'


    // Validar en que subcolección se guarda la respectiva evidencia
    if (subToUpload === 'C') { // Contratos
        collection = subContracts;
    } else if (subToUpload === 'F') { // Facturas
        collection = subFacts;
    } else {
        return pe_res.status(400).json({
            e_subrc: 4,
            msg: `Parámetro en URL "${subToUpload}" no soportado.`
        });
    }

    try {
        const factRef = db.collection(rfc).doc(subFiles).collection(collection).doc(uuid).collection(category);
        const doc = await factRef.get();

        doc.forEach(resp => {
            // console.log(resp.data().archivo)
            if (resp.data().archivo == archivo) {
                fileNameDOC.push(resp.data().archivo)
            }
        })

        for (let i in fileNameDOC) {
            if (fileNameDOC[i] !== "") {
                //Create a reference to the file to generate link
                let fileRefDOC = storageFOTO.bucket(bucketName).file(`${rfc}/${subFiles}/${collection}/${uuid}/${category}` + fileNameDOC[i]);
                await fileRefDOC.exists().then(async function (data) {
                    endpointDOC = await generateV4ReadSignedUrl(bucketNameGCP, rfc, subFiles, collection, uuid, category, `${fileNameDOC[i]}`);
                    endpoint.push(endpointDOC);
                });
            }
        }

        pe_res.status(200).json({
            e_subrc: 0,
            urlFOTO: endpoint,

        });

    } catch (error) {
        console.log(error)
        pe_res.status(400).json({ error });
    }



}

/* *** Obtener URL autenticada para acceder a los archivos *** */
async function generateV4ReadSignedUrl(bucketName, rfc, subFiles, collection, id, fotos, fileNameFOTO) {
    // These options will allow temporary read access to the file
    const options = {
        version: 'v4',
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    };

    // Get a v4 signed URL for reading the file
    const [url] = await storage
        .bucket(bucketName)
        .file(`${rfc}/${subFiles}/${collection}/${id}/${fotos}/` + fileNameFOTO)
        .getSignedUrl(options);

    return url;


}

// INI EAC: 30.03.2022 ELIMINAR ARCHIVOS DEL CFDI
const ctrl_deleteFile = async (pi_req = request, pe_res = response) => {
    const { rfcSociedad, sub, uuid, category, archivo } = pi_req.params;

    // Imports the Google Cloud client library
    const { Storage } = require('@google-cloud/storage');
    const bucketName = process.env.BUCKETNAME

    // Creates a client
    const storage = new Storage();

    // Referencia a Firebase
    db = admin.firestore();


    // Validar en que subcolección se guarda la respectiva evidencia
    if (sub === 'C') { // Contratos
        coleccion = subContracts;
    } else if (sub === 'F') { // Facturas
        coleccion = subFacts;
    } else {
        return pe_res.status(400).json({
            e_subrc: 4,
            msg: `Parámetro en URL "${subToUpload}" no soportado.`
        });
    }

    try {
        let filesRef = await db.collection(rfcSociedad).doc('ARCHIVOS').collection(coleccion).doc(uuid).collection(category);
        const docs = await filesRef.get();

        docs.forEach(async (resp) => {
            if (resp.data().archivo == archivo) {
                let filesRef = await db.collection(rfcSociedad).doc('ARCHIVOS').collection(coleccion).doc(uuid).collection(category).doc(resp.id).delete();
            }
        })

        await storage.bucket(bucketName).file(`${rfcSociedad}/ARCHIVOS/${coleccion}/${uuid}/${category}/${archivo}`).delete();

        return pe_res.json({
            e_subrc: 0,
            msg: 'Archivo eliminado correctamente'
        })
    } catch (error) {
        console.log(error)
        return pe_res.send(`Error al eliminar el archivo del proveedor ${rfcProv} - ${error}`)
    }


}
// INI EAC: 30.03.2022 ELIMINAR ARCHIVOS DEL CFDI


// INI SHV: 12.04.2022 ELIMINAR ARCHIVOS DE CONTRATO
const ctrl_deleteFileContract = async (pi_req = request, pe_res = response) => {
    const { rfcSociedad, sub, idContrato, category, archivo } = pi_req.params;

    // Imports the Google Cloud client library
    const { Storage } = require('@google-cloud/storage');
    const bucketName = process.env.BUCKETNAME

    // Creates a client
    const storage = new Storage();

    // Referencia a Firebase
    db = admin.firestore();


    // Validar en que subcolección se guarda la respectiva evidencia
    if (sub === 'C') { // Contratos
        coleccion = subContracts;
    } else if (sub === 'F') { // Facturas
        coleccion = subFacts;
    } else {
        return pe_res.status(400).json({
            e_subrc: 4,
            msg: `Parámetro en URL "${subToUpload}" no soportado.`
        });
    }

    try {
        let filesRef = await db.collection(rfcSociedad).doc('ARCHIVOS').collection(coleccion).doc(idContrato).collection(category);
        const docs = await filesRef.get();

        docs.forEach(async (resp) => {
            if (resp.data().archivo == archivo) {
                let filesRef = await db.collection(rfcSociedad).doc('ARCHIVOS').collection(coleccion).doc(idContrato).collection(category).doc(resp.id).delete();
            }
        })

        await storage.bucket(bucketName).file(`${rfcSociedad}/ARCHIVOS/${coleccion}/${idContrato}/${category}/${archivo}`).delete();

        return pe_res.json({
            e_subrc: 0,
            msg: 'Archivos eliminados correctamente'
        })
    } catch (error) {
        console.log(error)
        return pe_res.send(`Error al eliminar el archivo del contrato ${idContrato} - ${error}`)
    }


}
// FIN SHV: 12.04.2022 ELIMINAR ARCHIVOS DE CONTRATO


module.exports = { ctrl_carga, ctrl_lista, ctrl_down, ctrl_lista_gral, ctrl_deleteFile, ctrl_deleteFileContract }
/* *** Consultar lista *** */
async function getList(colecciones, rfc, coleccion, id) {

    let lista = new Object;
    // Referencia a Firebase
    db = admin.firestore();

    for (let i in colecciones) {
        lista[`${colecciones[i]}`] = [];
        const col = await db.collection(rfc).doc(subFiles).collection(coleccion).doc(id).collection(colecciones[i]).get();
        col.forEach(doc => {
            const file = doc.data();
            file.id = doc.id;
            lista[`${colecciones[i]}`].push(file);
        });
    }
    return lista;
}

//FUNCION PARA CONTRACTS
async function getListContracts(colecciones, rfc, coleccion, id) {

    let lista = new Object;
    // Referencia a Firebase
    db = admin.firestore();

    for (let i in colecciones) {
        lista[`${colecciones[i]}`] = [];
        const col = await db.collection(rfc).doc(subFiles).collection('CONTRATOS').doc(id).collection(colecciones[i]).get();
        col.forEach(doc => {
            const file = doc.data();
            file.id = doc.id;
            lista[`${colecciones[i]}`].push(file);
        });
    }
    return lista;
}

//FUNCION PARA FACTURAS
async function getListFacts(colecciones, rfc, coleccion, id) {

    let lista = new Object;
    // Referencia a Firebase
    db = admin.firestore();
    console.log('INICIA CONSULTA DOCUMENTOS')
    try {
        for (let i in colecciones) {
            lista[`${colecciones[i]}`] = [];



            const col = await db.collection(rfc).doc(subFiles).collection('FACTURAS').doc(id).collection(colecciones[i]).get();
            col.forEach(doc => {
                const file = doc.data();
                file.id = doc.id;
                lista[`${colecciones[i]}`].push(file);
            });
        }
    }
    catch (error) {
        console.log(error)
        return lista;
    }
    return lista;
}
/* *** Obtener colección(facturas/contratos) *** */
function getCol(code) {
    // Validar en que subcolección se extrae la respectiva evidencia
    if (code === 'C') { // Contratos
        return subContracts;
    } else if (code === 'F') { // Facturas
        return subFacts;
    } else {
        return 'N/A'
    }
}

/* *** Obtener formatos configurados *** */
async function getFormat(subCol) {
    // Referencia a Firebase
    db = admin.firestore();

    const formatRef = db.collection(dbFormatFiles).doc(subCol);
    const snapShot = await formatRef.get();
    if (snapShot.exists) {
        return snapShot.data().formato;
    } else {
        return [];
    }
}

/* *** Buscar categoría respectiva a acorde al formato *** */
function getCategory(aPhotos, aVideos, aAudio, aDocuments, format) {

    const photos = aPhotos.find(element => element === format) || '';
    const videos = aVideos.find(element => element === format) || '';
    const audio = aAudio.find(element => element === format) || '';
    const documents = aDocuments.find(element => element === format) || '';

    if (photos !== '' && videos === '' && audio === '' && documents === '') {
        return subPhotos;
    } else if (photos === '' && videos !== '' && audio === '' && documents === '') {
        return subVideos;
    } else if (photos === '' && videos === '' && audio !== '' && documents === '') {
        return subAudio;
    } else if (photos === '' && videos === '' && audio === '' && documents !== '') {
        return subDocuments;
    } else {
        return subOthers;
    }
}

/* *** Carga de archivo *** */
async function uploadFile(file, rfc, fileName, fileType, factOrContract, id, category, bucketName) {

    let route = '';
    let msg;

    // Instancia del bucket
    const bucket = storage.bucket(bucketName);

    route = `${rfc}/${subFiles}/${factOrContract}/${id}/${category}/`;

    let blob = bucket.file(route + fileName);
    let stream = blob.createWriteStream({
        metadata: {
            contentType: fileType
        }
    });
    try {
        // Error
        stream.on('error', err => {
            msg = {
                e_subrc: 4,
                msg: `Ha ocurrido un error al cargar ${fileName} - ${err}`
            }
        });

        // Success
        stream.on('finish', () => {
            msg = {
                e_subrc: 0,
                msg: `Archivo ${fileName} cargado.`
            }
        });

        // Cargar archivo
        stream.end(file);
        return msg;
    } catch (error) {
        return {
            e_subrc: 0,
            msg: `Error al cargar el archivo ${fileName} - ${error}`
        }

    }
}

/* *** Obtener hora de carga *** */
function gethoraCarga() {
    let date = new Date();
    let hora;
    let minutos;
    let seconds;

    //Hora de modificacion
    if (date.getHours() <= 9) {
        hora = '0' + date.getHours();
    } else {
        hora = date.getHours();
    }

    //Calculo de minutos
    if (date.getMinutes() <= 9) {
        minutos = '0' + date.getMinutes();
    } else {
        minutos = date.getMinutes();
    }

    //Calculo de secgundos
    if (date.getSeconds() <= 9) {
        segundos = '0' + date.getSeconds();
    } else {
        segundos = date.getSeconds();
    }

    return `${hora}:${minutos}:${segundos}`
}

// Obtener fecha de carga
function getfechaCarga() {
    const date = new Date();
    let dia = date.getDate();

    //
    let year = date.getFullYear();
    if ((date.getMonth() + 1) <= 9) {
        month = "0" + (date.getMonth() + 1);
    } else {
        month = (date.getMonth() + 1);
    }

    //
    if (date.getUTCDate() <= 9) {
        day = "0" + date.getUTCDate();
    } else {
        day = date.getUTCDate();
    }

    return `${day}-${month}-${year}`
}

async function checkIdContratoExist(rfc, idContrato) {
    const db = admin.firestore().collection(rfc).doc(subContracts);
    const fireSQL = new FireSQL(db, { includeId: 'idContrato' });
    await fireSQL.query(`SELECT * FROM HDR where __name__ = '${idContrato}' `).then(documents => {
        result = documents
    });
    if (result.length === 0) {
        return 4;
    } else {
        return 0;
    }
}

async function checkUuidExist(rfc, uuid) {
    const db = admin.firestore().collection(rfc).doc(subFacts);
    const fireSQL = new FireSQL(db, { includeId: 'uuid' });
    await fireSQL.query(`SELECT * FROM HDR where __name__ = '${uuid}' `).then(documents => {
        result = documents
    });
    if (result.length === 0) {
        return 4;
    } else {
        return 0;
    }
}

function fechaCargaEvidencia(){
    const date = new Date();
    let dia = date.getDate();

    //
    let year = date.getFullYear();
    if ((date.getMonth() + 1) <= 9) {
        month = "0" + (date.getMonth() + 1);
    } else {
        month = (date.getMonth() + 1);
    }

    //
    if (date.getUTCDate() <= 9) {
        day = "0" + date.getUTCDate();
    } else {
        day = date.getUTCDate();
    }

    return `${day}${month}${year}`
}


function horaCargaEvidencia(){
    let date = new Date();
    let hora;
    let minutos;
    let seconds; 
    
    //Hora de modificacion
    if (date.getHours() <= 9) {
        hora = '0' + date.getHours();
    } else {
        hora = date.getHours();
    }

    //Calculo de minutos
    if (date.getMinutes() <= 9) {
        minutos = '0' + date.getMinutes();
    } else {
        minutos = date.getMinutes();
    }

    //Calculo de secgundos
    if (date.getSeconds() <= 9) {
        segundos = '0' + date.getSeconds();
    } else {
        segundos = date.getSeconds();
    }

    return `${hora}${minutos}${segundos}`
}