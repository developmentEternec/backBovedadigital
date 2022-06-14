//Dependencies of NodeJS
const express = require('express');
const cors = require('cors');
require('dotenv');
const admin = require("firebase-admin");
const bodyParser = require('body-parser')

//Dependencies and credentials for Firebase
const serviceAccount = require("../crendentials/serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

class Server {

    constructor() {
        this.app = express();
        this.port = process.env.PORT;

        // Rutas
        this.login        = '/apiLogin';
        this.proveedores  = '/apiProv';
        this.facturas     = '/apiCFDI';
        this.sociedades   = '/apiSociedades';
        this.contratos    = '/apiContratos';
        this.archivos     = '/apiArchivos';
        this.utilerias    = '/apiUtilerias';
        this.credenciales = '/apiCredencial';
// INI JHN 25.05.2022
        this.dashboards   = '/apiDashboards';
// FIN JHN 25.05.2022

        //Midlewares
        this.middlewares();

        // Parse and read body
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.app.use(express.json());

        //Dependencies
        this.routes();
    }

    // Middlewares 
    middlewares() {

        //CORS
        this.app.use(cors());

        //Server with content static
        this.app.use(express.static('public'));
    }


    // Routes of process
    routes() {
        this.app.use(this.login      , require('../routes/auth.route'));
        this.app.use(this.facturas   , require('../routes/facturas.route'));
        this.app.use(this.proveedores, require('../routes/proveedores.route'));
        this.app.use(this.sociedades , require('../routes/sociedades.route'));
        this.app.use(this.contratos  , require('../routes/contratos.route'));
        this.app.use(this.archivos   , require('../routes/archivos.route'));
        this.app.use(this.utilerias  , require('../routes/utilerias.route'));
// INI JHN 25.05.2022
        this.app.use(this.dashboards , require('../routes/dashboards.route'));
// FIN JHN 25.05.2022
    }

    listen() {
        this.app.listen(this.port, () => {
            console.log('Api en ejecución  en el puerto ', this.port);
        });
    }

}

module.exports = Server;