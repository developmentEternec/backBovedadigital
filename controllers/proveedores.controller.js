const { response, request } = require('express');
const admin = require("firebase-admin");

// INI EAC 03.03.2022
const { Storage } = require('@google-cloud/storage');
// FIN EAC 03.03.2022

/* FireSQL */
const { FireSQL } = require('FireSQL');

// Nombre de la colección
dbNameProv = "PROVEEDORES";

// INI EAC 03.03.2022
// Subcolecciones para guardar archivos en Firebase
const subIdentificación = 'IDENTIFICACION';
const subrfcSociedad = 'ETE180806AQ5';
const subProveedor = 'PROVEEDOR';
const subAltaConstitutiva = 'ACTA_CONSTITUTIVA';
const subComprobanteDomicilio = 'COMPROBANTE_DOMICILIO';
const subAltaHacienda = 'ALTA_HACIENDA';
const subConstanciaSituacion = 'SITUACIÓN FISCAL';
const subEstadoCuenta = 'ESTADO_CUENTA';
const subOtros = 'OTROS';
const subFiles = 'ARCHIVOS';
const tvarvc = 'TVARVC_WEB';
const SINGLE_VALUES = 'SINGLE_VALUES';

const storage = new Storage({ keyFilename: 'key.json' });
// FIN EAC 03.03.2022

/* *** Obtener lista de proveedores *** */
const ctrl_lista = async (pi_req = request, pe_res = response) => {

    // Instancia de firestore
    db = admin.firestore();

    // RFC Sociedad
    const rfcSociedad = pi_req.params.rfcSociedad;

    // Referencia a la colección de proveedores
    const provRef = db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA');

    // Obtener lista de proveedores
    const snapshot = await provRef.get();
    if (snapshot.empty) {
        pe_res.status(400).json({
            e_subrc: 4,
            msg: 'No hay proveedores dados de alta.'
        });
        return;
    }

    // Enviar los documentos de los clientes en formato JSON
    pe_res.status(201).json(snapshot.docs.map((doc) => {
        const document = doc.data();
        document.rfc = doc.id;
        return document;
    }));

}

// INI EAC : 15.03.2022 informacion de archivos por Proveedor
/* * Obtener proveedor por rfc * */
const ctrl_infoProv = async (pi_req = request, pe_res = response) => {
    let IDENTIFICACION_OFICIAL = [];
    let ACTA_CONSTITUTIVA = [];
    let COMPROBANTE_DOMICILIO = [];
    let ALTA_HACIENDA = [];
    let CONSTANCIA_SF = [];
    let ESTADO_CUENTA = [];
    let OTROS = [];

    // Instancia de firestore
    db = admin.firestore();

    // RFC Sociedad
    const rfcSociedad = pi_req.params.rfcSociedad;

    // Obtener id de cliente de parámetros de la URL
    const rfcProv = pi_req.params.rfc;

    // Referencia a la colección de clientes
    try {

        const provRef = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv);
        const doc = await provRef.get();

        // INI EAC 04.03.2022
        // Se recupera coleccion de ACTA CONSTITUTIVA
        let getdata = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection('ACTA_CONSTITUTIVA');
        const actaConstitutiva = await getdata.get();
        actaConstitutiva.forEach(doc => {
            ACTA_CONSTITUTIVA.push(doc.data())
        })

        // Se recupera coleccion de IDENTIFICACION_OFICIAL
        getdata = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA')
            .doc(rfcProv).collection('IDENTIFICACION_OFICIAL');
        const identificacionOficial = await getdata.get();
        identificacionOficial.forEach(doc => {
            IDENTIFICACION_OFICIAL.push(doc.data())
        })

        // Se recupera coleccion de ALTA_HACIENDA
        getdata = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA')
            .doc(rfcProv).collection('ALTA_HACIENDA');
        const altaHacienda = await getdata.get();
        altaHacienda.forEach(doc => {
            ALTA_HACIENDA.push(doc.data())
        })

        // Se recupera coleccion de COMPROBANTE_DOMICILIO
        getdata = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA')
            .doc(rfcProv).collection('COMPROBANTE_DOMICILIO');
        const comprobanteDomicilio = await getdata.get();
        comprobanteDomicilio.forEach(doc => {
            COMPROBANTE_DOMICILIO.push(doc.data())
        })


        // Se recupera coleccion de CONSTANCIA_SF
        getdata = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA')
            .doc(rfcProv).collection('CONSTANCIA_SF');
        const constanciaSF = await getdata.get();
        constanciaSF.forEach(doc => {
            CONSTANCIA_SF.push(doc.data())
        })

        // Se recupera coleccion de ESTADO_CUENTA
        getdata = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA')
            .doc(rfcProv).collection('ESTADO_CUENTA');
        const estadoCuenta = await getdata.get();
        estadoCuenta.forEach(doc => {
            ESTADO_CUENTA.push(doc.data())
        })

        // Se recupera coleccion de OTROS
        getdata = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA')
            .doc(rfcProv).collection('OTROS');
        const otros = await getdata.get();
        otros.forEach(doc => {
            OTROS.push(doc.data())
        })


        // FIN EAC 04.03.2022

        // Info de proveedor
        const snapProv = await provRef.get();
        // Si el proveedor no existe enviar código y msg correspondiente
        if (!snapProv.exists) {
            pe_res.status(400).json({
                e_subrc: 4,
                msg: `El documento del proveedor: ${rfcProv} solicitado no existe.`,
            });
        }

        // Enviar información del proveedor
        const provJson = snapProv.data();
        provJson.rfc = snapProv.id;
        pe_res.status(201).json({
            provJson,
            ACTA_CONSTITUTIVA,
            IDENTIFICACION_OFICIAL,
            ALTA_HACIENDA,
            COMPROBANTE_DOMICILIO,
            CONSTANCIA_SF,
            ESTADO_CUENTA,
            OTROS
        })




    } catch (error) {
        console.log(error)
        pe_res.status(400).json({
            e_subrc: 4,
            msg: `El documento del proveedor: ${rfcProv} solicitado no existe.`,
        });
        return
    }
}
//FIN EAC : 15.03.2022 informacion de archivos por Proveedor

/* *** Obtener proveedor por rfc *** */
// const ctrl_infoProv = async (pi_req = request, pe_res = response) => {
//     // Instancia de firestore
//     db = admin.firestore();

//     // RFC Sociedad
//     const rfcSociedad = pi_req.params.rfcSociedad;

//     // Obtener id de cliente de parámetros de la URL
//     const rfcProv = pi_req.params.rfc;

//     // Referencia a la colección de clientes
//     try {
//         const provRef = await db.collection(rfcSociedad).doc(dbNameProv)
//             .collection('LISTA').doc(rfcProv);
//         // Info de proveedor
//         const snapProv = await provRef.get();
//         // Si el proveedor no existe enviar código y msg correspondiente
//         if (!snapProv.exists) {
//             pe_res.status(400).json({
//                 e_subrc: 4,
//                 msg: `El documento del proveedor: ${rfcProv} solicitado no existe.`,
//             });
// // GUHI
// 			return 
// //

//         }

//         // Enviar información del proveedor
//         const provJson = snapProv.data();
//         provJson.rfc = snapProv.id;
//         pe_res.status(201).send(provJson);
//     } catch (error) {
//         console.log(error)
//         pe_res.status(400).json({
//             e_subrc: 4,
//             msg: `El documento del proveedor: ${rfcProv} solicitado no existe.`,
//         });
//         return
//     }
// }

/* * Crear nuevo proveedor * */
const ctrl_crear = async (pi_req = request, pe_res = response) => {

    // Instancia de firestore
    db = admin.firestore();

    // RFC Sociedad
    const rfcSociedad = pi_req.params.rfcSociedad;

    // Obtener información de proveedor a guardar
    const proveedor = pi_req.body;
    let rfcProv = proveedor.rfc;

    let existe;
    //Validar si el RFC no esta en la lista negra
    existe = await getBlackListProv(rfcProv);
    if (existe) {
        pe_res.status(400).json({
            e_subrc: 4,
            msg: `El RFC ${rfcProv} existe en la lista negra, favor de verificar, no procede`
        });
    } else {
        // Eliminar la propiedad RFC que es meramente estructura para el front
        delete proveedor.rfc;

        // INI SHV 19.01.2022 Validar que el RFC del proveedor no exista, si existe se manda error
        const provRef = await db.collection(rfcSociedad)
            .doc(dbNameProv)
            .collection('LISTA').doc(rfcProv);

        const snapProv = await provRef.get();
        if (snapProv.exists) {
            pe_res.status(400).json({
                e_subrc: 4,
                msg: `El proveedor: ${rfcProv} ya existe.`,
            });
            return
        }
        // FIN SHV 19.01.2022

        // Realizar inserción
        try {
            await db.collection(rfcSociedad).doc(dbNameProv).set({});
            const result = await db.collection(rfcSociedad).doc(dbNameProv)
                .collection('LISTA').doc(rfcProv).set(proveedor);
            pe_res.status(200).json({
                e_subrc: 0,
                msg: `Alta de proveedor exitosa - ${rfcProv}.`
            });
        } catch (error) {
            pe_res.status(400).json({
                e_subrc: 4,
                msg: `Error al grabar en BD - ${error}`
            });
        }

    }

}

/* Obtener lista negra proveedores */
async function getBlackListProv(rfcProv) {
    let existe = false;

    // Instancia de firestore
    db = admin.firestore();

    // Referencia a la colección de proveedores
    const provRef = db.collection('LISTA_NEGRA').doc(rfcProv);

    // Obtener lista de proveedores
    const snapshot = await provRef.get();

    if (snapshot.data()) {
        // console.log('Si existe') 
        existe = true;
        return existe;
    } else {
        // console.log('No existe en lista negra por lo tanto insertamos')
        existe = false;
        return existe;
    }
    return existe;

}

const ctrl_actualizar = async (pi_req = request, pe_res = response) => {
    console.log('Entrando a actualizar info');

    // Instancia de firestore
    db = admin.firestore();

    // Parametros que recibimos por el enpoint o url
    const rfcSociedad = pi_req.params.rfcSociedad;
    const rfcProv = pi_req.params.rfc;
    const user = pi_req.params.user;
    const files = pi_req.files;
    const razonSocial = pi_req.body.razonSocial;
    let contratoObligatorio = pi_req.body.contratoObligatorio;
    let proveedor = pi_req.body.json;

    // Convertir un tipo de dato string a un dato Boolean
    if (contratoObligatorio == "true") {
        contratoObligatorio = contratoObligatorio === "true";
        // console.log(contratoObligatorio)
        // console.log(typeof (contratoObligatorio))
    } else {
        contratoObligatorio = contratoObligatorio.toLowerCase() === "true"
        // console.log(contratoObligatorio)
        // console.log(typeof (contratoObligatorio))
    }

    let cantidadArchivos;
    let fechaAlta;
    let horaAlta;
    let contador = 0;
    let fechaModificacion;
    let horaModificacion;
    let camposProveedor = {};
    let camposbasicos = {}
    let arrayNames = [];
    let data;
    let docFile;
    let arrayNamesWithDuplicates = [];
    let arrayFilename = [];
    let fileNamesDuplicate = [];
    let dataFile;
    const fecha = new Date();


    // Se recupera hora y fecha actual para pasar como fecha de modificacion y hora
    fechaModificacion = getfechaEmision(fecha);
    horaModificacion = gethoraEmision(fecha);


    try {
        cantidadArchivos = files.length;

        // Validamos que el JSON venga con información    
        if (proveedor == '' || proveedor == undefined) {
            pe_res.status(400).json({
                e_subrc: 0,
                msg: `Error al acutalizar informacion, JSON vacio`
            });
            return
        }

        camposbasicos.razonSocial = razonSocial;
        camposbasicos.contratoObligatorio = contratoObligatorio
        await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).update(camposbasicos);

        // Se valida que el usuario no cargue archivos en mp3 o mp4 y se mandar un erro
        files.forEach(element => {
            if (element.mimetype == 'audio/mpeg' || element.mimetype == 'video/mp4') {
                return pe_res.status(400).json({
                    e_subrc: 4,
                    msg: "No se aceptan audios y videos, favor de verificar"
                });
            }

        })

        // Se hace una consulta a Firebase para revisar si existe el proveedor o no
        let datos = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv);
        let doc = await datos.get();
        // Si no existe se manda un mensaje al front diciendo que este proveedor no existe
        if (doc.exists) {
            fechaAlta = doc.data().fechaAlta;
            horaAlta = doc.data().horaAlta;

        } else {
            return pe_res.status(400).json({
                e_subrc: 0,
                msg: `Error el proveedor  ${rfcProv} - no existe en BD.`
            });
        }

        //  Se convierte TEXTO en formato JSON
        proveedor = JSON.parse(proveedor);

        // //Actualización de campos de de Proveedor
        camposProveedor.razonSocial = razonSocial;
        camposProveedor.contratoObligatorio = contratoObligatorio;
        camposProveedor.fechaModif = fechaModificacion;
        camposProveedor.horaModif = horaModificacion;
        camposProveedor.fechaAlta = fechaAlta;
        camposProveedor.horaAlta = horaAlta;
        camposProveedor.userModif = user;
        camposProveedor.userAlta = doc.data().userAlta;

        // Obtenemos el nombre del Bucket de GCP para despues guardarlo en BD
        docFile = await db.collection(rfcSociedad).doc(tvarvc).collection(SINGLE_VALUES).doc('BUCKET_TO_SAVE_FILES_CLOUD_STORAGE');
        const bucketNameGCP = await docFile.get();


        //Se hace commit para actualizar campos de fecha de modificacion, usuario de modficiacion 
        await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).set(camposProveedor);

        // Guardar el nombre de los archivos que estan en el JSON en un array
        for (let i in proveedor) {
            for (let k in proveedor[i]) {
                arrayNamesWithDuplicates.push(proveedor[i][k].nombreArchivo)
            }
        }

        // En caso de que el nombre del archivo se cargue en 2 posiciones es decir
        // se borran del array los nombres repetidos
        data = new Set(arrayNamesWithDuplicates)
        arrayNames = [...data]
        // Se valida que los archivos cargados esten en el JSON, de lo contrario se manda un error
        if (arrayNames.length != cantidadArchivos) {
            return pe_res.status(400).json({
                e_subrc: 0,
                msg: `No coinciden los archivos cargados con la lista JSON`
            });
        }

        let contadorr = 0;
        let cposicion = 0;
        let posicion;
        let resPos;
        let bucketname = process.env.BUCKETNAME
        let arrayProvedor = [];
        let longitud;

        for (let i in proveedor) {
            cposicion;
            posicion = db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection(i);
            resPos = await posicion.get();
            resPos.forEach(pos => {
                cposicion = pos.id;
                //  console.log(pos.id)
                // console.log(cposicion)
            })
            for (let j in proveedor[i]) {
                arrayProvedor.push(proveedor[i][j])
                longitud = arrayProvedor.length
                longitud = longitud - 1;
                files[longitud].originalname = proveedor[i][j].nombreArchivo;
                if (proveedor[i][j].nombreArchivo == files[longitud].originalname) {
                    cposicion++;
                    proveedor[i][j].fechaModif = fechaModificacion;
                    proveedor[i][j].horaModif = horaModificacion;
                    proveedor[i][j].bucketGCP = bucketNameGCP.data().low;
                    await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection(i).doc(cposicion.toString()).set(proveedor[i][j]); await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection(i).doc(cposicion.toString()).set(proveedor[i][j]);
                    msg = uploadFile(files[longitud].buffer, subrfcSociedad, files[longitud].originalname, files[longitud].mimetype, subProveedor, rfcProv, i, bucketname)
                }

            }
            cposicion = 0;

        }

        return pe_res.status(200).json({
            e_subrc: 0,
            msg: `Actualización de proveedor: ${rfcProv} exitosa.`
        });



    } catch (error) {
        console.log(error)
        pe_res.status(400).json({
            e_subrc: 0,
            msg: `Error al acutalizar informacion de  ${rfcProv} - ${error}.`
        });
    }
}

// INI EAC: 14.03.2022  Descarga de archivos proveedor
// Descargar archivos del Proveedor
const ctrl_down = async (pi_req = request, pe_res = response) => {
    // Referencia a Firebase
    db = admin.firestore();
    const { rfc, rfcProv, category, archivo } = pi_req.params;

    try {
        // Instancia para obtencion de URL de archivos    
        const storageDocuments = new Storage();

         // Array para guardar nombre de archivos de coleccion
         let fileNameDOC = [];

         
        //Endpoint para acceso a los archivos
        let endpointDOC = '';
        let endpoint = [];

        // Nombre del bucket
        let bucketName = process.env.BUCKETNAME;

        const fileRef = await db.collection(rfc).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection(category);
        const doc = await fileRef.get();

        doc.forEach(resp => {
            // console.log(resp.data())
            if(resp.data().nombreArchivo == archivo){
                fileNameDOC.push(resp.data().nombreArchivo);
            }
        })

        for (let i in fileNameDOC) {
            if (fileNameDOC[i] !== "") {
                let fileRefDoc = storageDocuments.bucket(bucketName).file(`${rfc}/${subFiles}/${subProveedor}/${rfcProv}/${category}` + fileNameDOC[i]);
                await fileRefDoc.exists().then(async function (data) {
                    endpointDOC = await generateV4ReadSignedUrl(bucketName, rfc, subFiles, subProveedor, rfcProv, category, `${fileNameDOC[i]}`);
                    endpoint.push(endpointDOC);
                })
            }
        }

        pe_res.status(200).json({
            e_subrc: 0,
            urlDOC: endpoint,
        });  
        
    } catch (error) {
        console.log(error)
        pe_res.status(400).json({ error });
    }


}
// FIN EAC: 14.03.2022  Descarga de archivos proveedor

// INI EAC 14.03.2020 genración de url para descarga de archivos
/* * Obtener URL autenticada para acceder a los archivos * */
async function generateV4ReadSignedUrl(bucketName, rfc, subFiles, provedores, rfcproveedor, archivo, fileName) {
    // These options will allow temporary read access to the file
    const options = {
        version: 'v4',
        action: 'read',
        expires: Date.now() + 5 * 60 * 1000, // 15 minutes
    };

    // Get a v4 signed URL for reading the file
    const [url] = await storage
        .bucket(bucketName)
        .file(`${rfc}/${subFiles}/${provedores}/${rfcproveedor}/${archivo}/` + fileName)
        .getSignedUrl(options);

    return url;


}
// FIN EAC 14.03.2020 genración de url para descarga de archivo

// INI EAC: 14.03.2022 ELIMINAR ARCHIVOS DEL PROVEEDOR
const ctrl_deleteFile = async (pi_req = request, pe_res = response) => {

    // Referencia a Firebase
    db = admin.firestore();
    // Imports the Google Cloud client library
    const { Storage } = require('@google-cloud/storage');
    const bucketName = process.env.BUCKETNAME
    
    //Variables
    const rfcSociedad = pi_req.params.rfcSociedad;
    const rfcProv = pi_req.params.rfcProv;
    const user = pi_req.params.user;
    const category = pi_req.params.category;
    const archivo = pi_req.params.archivo;
    let arrayNamesWithDuplicates = [];
    let coleccion = 'PROVEEDOR';
    let contador = 1;
    try {
        let filesRef = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection(category);
        const docs = await filesRef.get();
        docs.forEach(async (resp) =>{            
            if(resp.data().nombreArchivo == archivo){
                let filesRef = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection(category).doc(resp.id).delete(); 
                await storage.bucket(bucketName).file(`${rfcSociedad}/ARCHIVOS/${coleccion}/${rfcProv}/${category}/${archivo}`).delete();                
            }           
        })
        return pe_res.json({
            e_subrc: 0,
            msg: 'Archivos eliminados correctamente'
        })
            

    } catch (error) {
        console.log(error)
        return pe_res.send(`Error al eliminar el archivo del proveedor ${rfcProv} - ${error}`)
    }

}
// FIN  EAC: 14.03.2022 ELIMINAR ARCHIVOS DEL PROVEEDOR

/* *** Eliminar proveedor *** */
const ctrl_eliminar = async (pi_req = request, pe_res = response) => {
    // Instancia de firestore
    db = admin.firestore();

    // RFC Sociedad
    const rfcSociedad = pi_req.params.rfcSociedad;

    // Obtener id de proveedor de parámetros de URL
    const rfcProv = pi_req.params.rfc

    // Obtención de lista de contratos que tienen proveedor solicitado a borrar
    const dbSearch = admin.firestore().collection(rfcSociedad).doc('CONTRATOS');
    const fireSQL = new FireSQL(dbSearch, { includeId: 'idContrato' });
    console.log(`SELECT * FROM HDR where rfcProveedor = '${rfcProv}' AND estatus != '01'`)
    const contractList = await fireSQL.query(`SELECT * FROM HDR where rfcProveedor = '${rfcProv}' AND estatus != '01'`)
        .then(documents => {
            return documents
        });

    if (contractList.length > 0) {
        pe_res.status(400).json({
            e_subrc: 4,
            msg: `Proveedor ${rfcProv} asignado a contrato(s), no es posible borrar.`
        })
        return
    }

    try {
        //Elimnar alta hacienda
        let getdata = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection('ALTA_HACIENDA');
        const altaHacienda = await getdata.get();
        altaHacienda.forEach(async(resp) => {
            let eliminar = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection('ALTA_HACIENDA').doc(resp.id).delete();
           
        })

        //Elimnar identificacion oficial
        getdata = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection('IDENTIFICACION_OFICIAL');
        const identificacionOficial = await getdata.get();
        identificacionOficial.forEach(async(resp) => {
            let eliminar = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection('IDENTIFICACION_OFICIAL').doc(resp.id).delete();
           
        })

        //Elimnar otros
        getdata = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection('OTROS');
        const otros = await getdata.get();
        otros.forEach(async(resp) => {
            let eliminar = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection('OTROS').doc(resp.id).delete();
        })

        //Elimnar comprobante_domicilio
        getdata = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection('COMPROBANTE_DOMICILIO');
        const comprobanteDomicilio = await getdata.get();
        comprobanteDomicilio.forEach(async(resp) => {
            let eliminar = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection('COMPROBANTE_DOMICILIO').doc(resp.id).delete();
        })

        //Elimnar alta_constitutiva
        getdata = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection('ACTA_CONSTITUTIVA');
        const altaConstitutiva = await getdata.get();
        altaConstitutiva.forEach(async(resp) => {
            let eliminar = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection('ACTA_CONSTITUTIVA').doc(resp.id).delete();
        })

        //Elimnar estado de cuenta
        getdata = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection('ESTADO_CUENTA');
        const estadoCuenta = await getdata.get();
        estadoCuenta.forEach(async(resp) => {
            let eliminar = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection('ESTADO_CUENTA').doc(resp.id).delete();
        })

        //Elimnar constancia de situacion fiscal
        getdata = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection('CONSTANCIA_SF');
        const situacionFiscal = await getdata.get();
        situacionFiscal.forEach(async(resp) => {
            let eliminar = await db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA').doc(rfcProv).collection('CONSTANCIA_SF').doc(resp.id).delete();
        })
        
        await db.collection(rfcSociedad)
            .doc(dbNameProv)
            .collection('LISTA')
            .doc(rfcProv)
            .delete();
        pe_res.status(200).json({
            e_subrc: 0,
            msg: `Proveedor ${rfcProv} borrado.`
        })
    } catch (error) {
        pe_res.status(400).json({
            e_subrc: 4,
            msg: `Error al eliminar proveedor: ${rfcProv} - ${error}`
        });
    }

}

/* *** Realizar búsqueda *** */
const ctrl_buscar = async (pi_req = request, pe_res = response) => {

    // RFC Sociedad
    const rfcSociedad = pi_req.params.rfcSociedad;

    // Colección a buscar
    const db = admin.firestore().collection(rfcSociedad).doc('PROVEEDORES');

    const lv_where = pi_req.body.where;

    if (lv_where == '' || lv_where.length == 0) {
        pe_res.status(400).json({
            msg: `Debe ingresar al menos un campo para realizar la búsqueda.`,
            e_subrc: 4
        });
        return;
    }

    // And then just pass that reference to FireSQL
    const fireSQL = new FireSQL(db, { includeId: 'rfc' });
    let result = {};
    try {
        if (lv_where == '*') {
            await fireSQL.query(`SELECT * FROM LISTA `).then(documents => {
                result = documents
            });
        } else {
            await fireSQL.query(`SELECT * FROM LISTA where ${lv_where}`).then(documents => {
                result = documents
            });
        }


        // Enviar los documentos de los clientes en formato JSON
        pe_res.status(201).json(result);
    } catch (error) {
        pe_res.status(400).json({
            msg: `Ha ocurrido un error al efectuar la consulta, favor de contactar con el administrador - ${error}`,
            e_subrc: 4
        });
    }
}

async function getProvList(rfcSociedad, dbNameProv) {

    let provList = {};

    // Instancia de firestore
    db = admin.firestore();

    // Referencia a la colección de proveedores
    const provRef = db.collection(rfcSociedad).doc(dbNameProv).collection('LISTA');

    // Obtener lista de proveedores
    const snapshot = await provRef.get();

    if (snapshot.empty) {
        return provList;
    } else {
        provList = snapshot.docs.map((doc) => {
            const document = doc.data();
            document.rfc = doc.id;
            return document;
        });
        return provList;
    }

}

// Metodo para obtener fecha en formato  dd/mm/yyyy
function getfechaEmision(fecha) {
    let date = new Date(fecha);
    let month;
    let day;

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
    return `${day}-${month}-${year}`;
}

// Metodo para obtener formato de horas
/* * Parseo de hora de emisión * */
function gethoraEmision(fecha) {
    let date = new Date(fecha);
    let hora;
    let minutos;
    let segundos

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

    return `${hora}:${minutos}:${segundos}`;

}

/* *** Carga de archivo *** */
async function uploadFile(file, rfc, fileName, fileType, archive, id, category, bucketName) {
    console.log('si entra')
    let route = '';
    let msg;

    // Instancia del bucket
    const bucket = storage.bucket(bucketName);

    route = `${rfc}/${subFiles}/${archive}/${id}/${category}/`;

    let blob = bucket.file(route + fileName);
    let stream = blob.createWriteStream({
        metadata: {
            contentType: fileType
        }
    });
    try {
        // Error
        msg = stream.on('error', err => {
            const msg = {
                e_subrc: 4,
                msg: `Ha ocurrido un error al cargar ${fileName} - ${err}`
            }
            return msg;
        });

        // Success
        msg = stream.on('finish', () => {
            const msg = {
                e_subrc: 0,
                msg: `Archivo ${fileName} cargado.`
            }
            return msg;
        });

        // Cargar archivo
        stream.end(file);
    } catch (error) {
        msg = {
            e_subrc: 0,
            msg: `Error al cargar el archivo ${fileName} - ${error}`
        }
        console.log(error);
    }
    // console.log('Stream ' + msg);
    return msg;
}

module.exports = {
    ctrl_lista,
    ctrl_infoProv,
    ctrl_crear,
    ctrl_actualizar,
    ctrl_eliminar,
    ctrl_buscar,
    ctrl_down,
    ctrl_deleteFile,
}