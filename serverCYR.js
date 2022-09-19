const express = require("express");
const app = express();
const { Client } = require("pg");

// Begrenzung der Datenmenge damit die Bilder verarbeitet werden können
app.use(express.json({limit: '10mb'}));

// Verwendung des CORS-Moduls für Aufrufe vom Localhost
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:8000");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );
    // Zulässig sind nur GET und POST Methoden
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST"
    );
    next();
});

// Erstellen eines Clients zur Verbidnung mit der PostegreSQL-Datenbank
const DB_client = new Client({
    user: 'seminar',
    host: '127.0.0.1',
    database: 'abschluss_db',
    password: 'secret_password',
    port: 5432,
})

// Herstellung der Client-Verbindung zur Datenbank
DB_client.connect()

//POST-Request: Empfangen der neuen Meldung vom Client und weiterleiten an die Datenbank
app.post('/newRequest', function (req, response) {

    console.log("Server empfing folgende Formulardaten:", req.body)
    data = req.body

    // Die empfangenen Daten vom Client werden in die Datenbank eingfügt
    const query = {
        text: "INSERT INTO meldungen (date, name, mail, latitude, longitude, photo, type, description, behoben) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        values: [data.date, data.name, data.mail , data.latitude , data.longitude , data.photo , data.type , data.description, data.behoben],
    }

    //Ausführen der Querry mit jeweiliger Succes und Error Response die an den Client gesendet wird
    DB_client.query(query, (err, res) => {
        if (err) {
            response.status().send({success: false, response: err.stack})
        } else {
            response.status(200).send({success: true, response: "Response Code 200 OK"})
        }
    })
});

// POST-Request zur Änderung des behoben Status
app.post('/changeBehoben', function (req, response) {

    console.log("Server empfing folgende Formulardaten:", req.body)
    data = req.body

    //Die passende id wird mit dem Server abgeglichen und dort der behoben Boolean geupdatet
    const query = {
        text: "UPDATE meldungen SET behoben = $2 WHERE id = $1",
        values: [data.id, data.behoben],
    }

    DB_client.query(query, (err, res) => {
        if (err) {
            response.status().send({success: false, response: err.stack})
        } else {
            response.status(200).send({success: true, response: "Response Code 200 OK"})
        }
    })
});

// GET-Request für die Anzeige der Marker
app.get('/getProblems', function (req, response){
    console.log("Server empfing folgende Formulardaten:", req.route)

    // Selektiere alles bis auf die Fotos, da diese die Ladezeiten stark erhöhen
    const query = {
        text: "SELECT id, date, name, mail, latitude, longitude, type, description, behoben FROM meldungen"
    }

    DB_client.query(query, (err, res) => {
        if (err) {
            response.status().send({success: false, response: err.stack})
        } else {
            response.status(200).send({success: true, response: res})
        }
    })
});

//Angeben des Serverports
const server = app.listen(40148, () => {
    const port = server.address().port
    console.log(`Erreichbar über Port: ${port}`)
});
