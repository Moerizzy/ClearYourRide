//Wait for the deviceready event before using any of Cordova's device APIs.
//See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready
document.addEventListener('deviceready', onDeviceReady, false);

//Variablen für Funktionen die im HTML Dokument aufgerufen werden
var openForm;
var closeForm;
var nextPrev;
var cameraTakePicture;
var storageTakePicture;
var validateForm;
var changeBehobenStatus;

function onDeviceReady() {

    /*************************************************************************
     * Funktionen für den aktuellen Standort                                 *
     *************************************************************************/

    //Success callback, um Leaflet Karte auf aktuelle abgefragte Geolocation zu aktualisieren
    var onGeolocationSuccess = function (position) {
        var updatedLatitude = position.coords.latitude;
        var updatedLongitude = position.coords.longitude;

        if (updatedLatitude !== curLatitude && updatedLongitude !== curLongitude) {
            curLatitude = updatedLatitude;
            curLongitude = updatedLongitude;

            //Alten Marker entfernen und Neuen setzen
            if (currentPositionMarker) {
                map.removeLayer(currentPositionMarker);
            }
            currentPositionMarker = new L.marker([curLatitude, curLongitude], {
                icon: L.icon({
                    iconUrl: 'img/pos.png',
                    iconSize: [35, 35]
                })
            }).bindPopup("Aktuelle Position").addTo(map);

            //Auf den Standort zentrieren falls gewünscht
            if (centerCurrentPosition) {
                map.setView({lat: curLatitude, lon: curLongitude});
            }
        }
    }

    //Error callback, wenn aktuelle abgefragte Geolocation nicht funktioniert hat
    function onGeolocationError(error) {
        console.log('Abfrage der Geolocation fehlgeschlagen'+ '\n' +
            'code: ' + error.code + '\n' +
            'message: ' + error.message + '\n');
    }

    //Funktion um die aktuelle Position zu beobachten
    function watchMapPosition() {
        return navigator.geolocation.watchPosition
        (onGeolocationSuccess, onGeolocationError, {enableHighAccuracy: true});
    }

    //Funktion um Knopf hinzuzufügen, welcher das automatische Aktualisieren der Position ein- und ausschaltet
    function createGeolocationButton() {

        var command = L.control({position: 'topleft'});
        command.onAdd = function (map) {
            centerCurrentPositionControlDiv = L.DomUtil.create('div', 'controlDiv');

            //Aussehen (Bild) des Knopfes unterscheidet sich, jenachdem ob die Standortzentrierung aktiviert ist
            centerCurrentPositionControlDiv.innerHTML =
                '<button id="positionFixed"  class="mapButton hoverBtn"><img id="positionFixedImage" src="img/pos_' + centerCurrentPosition + '.png"  alt="Position zentireren" height="18"></button>';

            return centerCurrentPositionControlDiv;
        };
        command.addTo(map);

        document.getElementById("positionFixed").addEventListener('click', function (eve) {
            updateCenterCurrentPosition(!centerCurrentPosition);
        });
    }

    //Event Handler um das automatische Aktualisieren der Position ein- und auszuschalten
    function updateCenterCurrentPosition(centerCurrentPositionValue) {
        if (centerCurrentPosition !== centerCurrentPositionValue &&
            (centerCurrentPositionValue === true || centerCurrentPositionValue === false)) {
            centerCurrentPosition = centerCurrentPositionValue;

            console.log("Standortzentrierung", centerCurrentPosition? "aktiviert":"deaktiviert");

            //Falls Standortzentrierung aktiviert wird auch direkt auf den Standort zentrieren
            if (centerCurrentPosition) {
                map.setView({lat: curLatitude, lon: curLongitude});
            }

            //Auch das Aussehen (Bild) des Knopfes anpassen
            document.getElementById("positionFixedImage").src = "img/pos_" + centerCurrentPositionValue + ".png";
        }
    }

    /*************************************************************************
     * Funktionen für Marker der Misstände (und der zugehörigen Legende)     *
     *************************************************************************/

    //Funktion zum laden der Missstände für Marker vom Server
    function getReportedGrievances(callback) {
        //GET-Abfrage mit Callback-Funktion, damit auf das Laden der Daten gewartet wird
        $.ajax({
            type: "GET",
            contentType : "application/json",
            url: "http://igf-srv-lehre.igf.uni-osnabrueck.de:40148/getProblems", 
    
            //Success Callback mit Umwandlung des JSON in ein Array
            success: function(result, status, xhr){
                console.log("Abfragen der Misstände erfolgreich. Status: " + status);
                var result_array = [];
                for(let i in result.response.rows)
                     result_array.push(Object.values(result.response.rows[i]));

                callback(result_array);
            } ,

            //Error Callback, logge den Fehler und fahre fort
            error: function(xhr, status_err, errormeldung){
                console.log("Abfragen der Misstände fehlgeschlagen. Status: " + status_err + " Error: " + errormeldung);
            }
        });
    }
    
    //Funktion um Marker in der Leaflet-Karte hinzuzufügen
    function showGrievancesMarkers(problems) {
        reportedGrievances = problems;

        //Für die Legende das minimale und maximale Datum aller Misstände ermitteln,
        //falls dieses Zeitfenster nicht vom Benutzer selbst gesetzt wurde
        if (!filterGrievancesWithDates) {
            var grievancesTimeMin = '9999-12-30';
            var grievancesTimeMax = '0000-01-01';
            reportedGrievances.forEach(function (item) {
                grievancesTimeMin = (grievancesTimeMin > item[1]) ? item[1].split("T")[0] : grievancesTimeMin;
                grievancesTimeMax = (item[1] > grievancesTimeMax) ? item[1].split("T")[0] : grievancesTimeMax;
            });

            //Ermitteltes Zeitfenser in der Legende anpassen
            grievancesTimeFrom = grievancesTimeMin;
            grievancesTimeTo = grievancesTimeMax;
            document.getElementById("legendFrom").value = grievancesTimeFrom;
            document.getElementById("legendTo").value = grievancesTimeTo;
        }

        //Marker mit Clustering hinzufügen
        reportedGrievancesMarkers = new L.MarkerClusterGroup({
            //Marker für zusammengefassten Missstände enthält die Anzahl der zusammengefassten Missstände
            iconCreateFunction: function (cluster) {
                return L.divIcon({
                    html: '<b>' + cluster.getChildCount() + '</b>',
                    className: 'marker-cluster',
                    iconSize: [35, 35]
                });
            }
        });

        reportedGrievances.forEach(function (item) {
            //Prüfe Filter für anzuzeigende Kategorien, anzuzeigendes Datum und nur aktuelle Missstände
            if ((!hideFixedGrievances || !item[8])
                && grievancesCategories[item[6]].showCategory
                && grievancesTimeFrom <= item[1].split("T")[0] && item[1].split("T")[0] <= grievancesTimeTo) {

                //Verschiedene Marker für verschiedene Missstandsarten
                var meldungMarker = L.icon({
                    iconUrl: 'img/marker_' + item[6] + '.png',
                    iconSize: [25, 35]
                })
                
                //Popup mit Informationen zum Punkt hinzufügen
                var popup;
                for (key in grievancesCategories) {
                    if (key === item[6]) {
                        popup = '<h1 class="description">' + grievancesCategories[key].name + '</h1>';
                    }
                }
                popup += '<label class="popupText">Beschreibung:&nbsp;&nbsp;' + item[7] + '<br>' +
                         '<label class="popupText">Datum:&nbsp;&nbsp;' + item[1].slice(0,10) + '<br>';

                //Popup enthält die Möglichkeit den Missstand als (nicht) behoben zu Markieren
                if (item[8] === false) {
                    popup += '<button id="resolveGrievancesButtonId" class="mapButton confirmButton" ' +
                        'style="font-size: 12px; padding: 10px 15px" ' +
                        'onclick="changeBehobenStatus(' + item[0] + ',' + item[8] + ')" > Missstand als behoben markieren </button>';
                } else if (item[8] === true) {
                    popup += '<button id="notResolveGrievancesButtonId" class="mapButton confirmButton" ' +
                        'style="font-size: 12px; padding: 10px 15px" ' +
                        'onclick="changeBehobenStatus(' + item[0] + ',' + item[8] + ')"> Missstand als nicht behoben markieren </button>';
                }

                var m = L.marker([item[4], item[5]], {icon: meldungMarker}).bindPopup(popup);

                reportedGrievancesMarkers.addLayer(m);
            }

        });

        map.addLayer(reportedGrievancesMarkers);
    }

    //Verwaltet einen Event Handler, der aufgerufen wird, wenn der behoben Status gändert wird
    changeBehobenStatus = function changeBehobenStatus(id , behoben){
        //Erstellen eines neuen JSON mit allen nötigen Informationen
        var behobenJSON = {"id" : id, "behoben" : !behoben}
        behobenJSON = JSON.stringify(behobenJSON)
        console.log(behobenJSON)
        
        //AJAX POST Anfrage zum Anpassen des Behoben-Status
        $.ajax({
            type: "POST",
            contentType : "application/json",
            data: behobenJSON,
            url: "http://igf-srv-lehre.igf.uni-osnabrueck.de:40148/changeBehoben", 
    
            success: function(result, status, xhr){
                console.log("Ändern des Behoben-Status erfolgreich. Status: " + status);
            } ,
    
            error: function(xhr, status_err, errormeldung){
                console.log("Ändern des Behoben-Status fehlgeschlagen. Status: " + status_err + " Error: " + errormeldung);
            }
        });
    };

    //Funktion welche eine Legende mit Filterfunktion für die Marker der Missstände hinzufügt
    function createMarkerFilter() {
        lControlLegend = L.control({position: 'topright'});

        lControlLegend.onAdd = function (map) {
            var div = L.DomUtil.create('div', 'mapWindows legendDiv legendDiv_hide_' + hideLegend);

            //Knopf um die Legende ein- bzw. auszuklappen
            div.innerHTML = '<div align="right"><button id="hideLegendButton" class="mapButton hoverBtn">' +
                '<img id="hideLegendImage" src="img/hideLegend_' + hideLegend + '.png" alt="Legende ein/ausblenden" height="20"></button></div>';

            //Falls Legende angezeigt werden soll
            if (!hideLegend) {
                div.innerHTML += '<div class="legendText">';

                //Filter für verschiedene Misstandsarten
                var tableCategories = '<label class="description"> Kategorien:</label><table>\n';
                let key;
                for (key in grievancesCategories) {
                    var categoryChecked = (grievancesCategories[key].showCategory)? "checked" : "";
                    tableCategories += '  <tr>\n' +
                        '    <td><input id="legendCategory' + key + '" type="checkbox" name="' + key + '"' + categoryChecked +  '/></td>\n' +
                        '    <th>' + grievancesCategories[key].name + '</th>' +
                        '    <td><img src="img/marker_' + key + '.png" alt="" height="35"></td>\n' +
                        '  </tr>\n';
                }
                div.innerHTML += tableCategories;

                //Filter für verschiedene Zeiträume
                div.innerHTML += '<label class="description">Zeitraum: </label><br>' +
                    '<label> Von <input id="legendFrom" class="legendInput" type="date" value="' + grievancesTimeFrom + '" name="from"> </label><br>' +
                    '<label> Bis <input id="legendTo" class="legendInput" type="date" value= "' + grievancesTimeTo + '" name="to"> </label><br>'

                //Filter für Behoben-Status
                var hideFixedGrievancesChecked = (hideFixedGrievances)? "checked" : "";
                div.innerHTML +=
                    '<input id="legendFixed" type="checkbox"' + hideFixedGrievancesChecked + '>' +
                    '<label for="legendFixed">Behobene ausblenden';


                div.innerHTML += '</div>';
         }

            return div;
        };

        lControlLegend.addTo(map);

        //Event Handler um die Legende ein- bzw. auszuklappen.
        document.getElementById("hideLegendButton").addEventListener('click', function (eve) {
            console.log("Legende", hideLegend? "einblenden": "ausblenden");

            hideLegend = !hideLegend;
            lControlLegend.remove();
            createMarkerFilter();
        });

        //Falls Legende angezeigt werden soll, Event Handler für die Filter hinzufügen
        //Es werden jeweils die entsprechenden Zustandsvariablen angepasst und alle Marker neugezeichnet
        if (!hideLegend) {

            //Filtern nach Kategorie
            function handleCommandLegendCategory(elem) {
                console.log("Filter für Kategorie", elem.name, elem.checked? "aktiviert": "deaktiviert");
                grievancesCategories[elem.name].showCategory = elem.checked;

                reportedGrievancesMarkers.clearLayers();
                getReportedGrievances(showGrievancesMarkers);
            }

            let key;
            for (key in grievancesCategories) {
                document.getElementById("legendCategory" + key).addEventListener('click', function (eve) {
                    handleCommandLegendCategory(this);
                });
            }


            //Filtern nach Zeitraum
            function handleCommandLegendTimeperiod() {
                console.log("Filter für Zeitfenster angepasst. Von", grievancesTimeFrom, "bis", grievancesTimeTo);
                filterGrievancesWithDates = true;
                grievancesTimeFrom = document.getElementById("legendFrom").value
                grievancesTimeTo = document.getElementById("legendTo").value;

                reportedGrievancesMarkers.clearLayers();
                getReportedGrievances(showGrievancesMarkers);
            }

            document.getElementById("legendFrom").addEventListener("change", handleCommandLegendTimeperiod, false);
            document.getElementById("legendTo").addEventListener("change", handleCommandLegendTimeperiod, false);


            //Filtern nach behoben
            function handleCommandLegendFixed() {
                console.log("Filter nur behobene Misstände anzeigen", this.checked? "aktiviert":"deaktiviert");

                hideFixedGrievances = this.checked;

                reportedGrievancesMarkers.clearLayers();
                getReportedGrievances(showGrievancesMarkers);
            }

            document.getElementById("legendFixed").addEventListener("click", handleCommandLegendFixed, false);
        }

    }


    /*************************************************************************
     * Formular - Verarbeiten der Eingaben und abschicken an den Server      *
     *************************************************************************/

    //Die Funktion zeigt eine bestimmte Seite des Fomulars (Verschiedene Div Instanzen)
    function showTab(n) {
        var x = document.getElementsByClassName("tab");
        x[n].style.display = "block";
        //Setzten des Weiter, Zurück und Submit Buttons an den jeweiligen Stellen
        if (n === 0) {
            document.getElementById("prevBtn").style.display = "none";
        } else {
            document.getElementById("prevBtn").style.display = "inline";
        }
        if (n === (x.length - 1)) {
            document.getElementById("nextBtn").style.display = "none";
            document.getElementById("submit").style.display = "block";
        } else {
            document.getElementById("submit").style.display = "none"
            document.getElementById("nextBtn").style.display = "block";
            document.getElementById("nextBtn").innerHTML = "Weiter";
        }
        //Die Seitenanzeige wird aktualisiert
        fixStepIndicator(n)
    }

    //Diese Funktion verwaltet das Vor- und Zurückspringen im Formular
    nextPrev = function nextPrev(n) {
        var x = document.getElementsByClassName("tab");

        //Beende die Funktion und gebe false zurück, falls die Eingabe nicht valide ist
        if (n === 1 && !validateForm()) return false;

        x[currentTab].style.display = "none";
        currentTab = currentTab + n;

        showTab(currentTab);
    }

    //Die Funktion validiert die Felder bei dem Zwischenschritt
    validateForm = function validateForm() {
        var thisTab, checkInput, i, valid = true;
        thisTab = document.getElementsByClassName("tab");
        checkInput = thisTab[currentTab].getElementsByClassName("input");

        //Eine For-Schleife kontrolliert jedes Feld, ob es ausgefüllt ist
        for (i = 0; i < checkInput.length; i++) {
            //Falls das Feld leer ist wird dem Klassennamen "invalid" hinzugefügt -> Für die Darstellung der Farbe
            if (checkInput[i].value === "") {
                checkInput[i].className += " invalid";
                valid = false;
            } else {
                //Falls es ausgefüllt ist, zurücksetzen des Klassennamen
                checkInput[i].className = "input";
            }
        }
        //Zurückgeben des Validierungsstatus
        return valid;
    }

    //Diese Funktion verwaltet die Seitenmarkierung
    function fixStepIndicator(n) {
        //Sie enterfnt alle mit "active" markierten steps
        var i, x = $(".step");
        for (i = 0; i < x.length; i++) {
            x[i].className = x[i].className.replace(" active", "");
        }
        //Und fügt dem aktuellen step diesen Klassennamen hinzu
        x[n].className += " active";
    }

    //Diese Funktion öffnet das PopUp Formular
    openForm = function openForm() {
        document.getElementById("popupForm").style.display = "block";
    };

    //Diese Funktion schließt das PopUp Formular und setzt es zurück
    closeForm = function closeForm() {
        document.getElementById("popupForm").style.display = "none";
        document.getElementById("formRequest").reset();
        document.getElementById("problemImage").style.display = "none";

        //Zurücksetzen der invaliden Felder des Formulars
        x = document.getElementsByClassName("tab");
        y = x[currentTab].getElementsByClassName("input");
        for (i = 0; i < y.length; i++) {
            y[i].className = "input";
        }

        //Das Formular auf die Anfangsseite setzen
        if (currentTab > 0) {
            nextPrev(-1);
        } else {
            nextPrev(currentTab);
        }
    }

    //Diese Funktion verwaltet den Aufruf der Kamera
    cameraTakePicture = function cameraTakePicture() {
        navigator.camera.getPicture(onSuccess, onFail, {
            quality: 50,
            destinationType: Camera.DestinationType.DATA_URL
        });
    }

    //Diese Funktion verwaltet den Aufruf der Galerie
    storageTakePicture = function storageTakePicture() {
        navigator.camera.getPicture(onSuccess, onFail, {
            quality: 50,
            destinationType: Camera.DestinationType.DATA_URL,
            sourceType: Camera.PictureSourceType.PHOTOLIBRARY
        });
    }

    //Success Callback für die Kamerafunktionen
    function onSuccess(imageData) {
        //Bild wird als String gespeichert
        var image = document.getElementById("problemImage");
        image.src = "data:image/jpeg;base64," + imageData;
        //Das Bild wird dem versteckten Input Feld hinzugefügt und dargestellt
        document.getElementById("photo").value = imageData;
        document.getElementById("problemImage").style.display = "block";
    }

    //Error Callback für die Kamerafunktionen
    function onFail(message) {
        console.log("Zugriff auf die Kamera fehlgeschlagen. Message:", message);
        alert('Failed because: ' + message);
    }

    //Verschicken der Daten an den Server
    document.getElementById("formRequest").addEventListener("submit", function (event) {
        //Dabei einen automatischen Submit verhindern
        event.preventDefault();

        //Auschalten des Submit Buttons und Visuelle Veränderung --> Damit es nicht zum mehrmaligen Abschicken kommt
        var submit = document.getElementById("submit");
        submit.disabled = true;
        submit.innerText = 'wird bearbeitet...';
        submit.style.background = "#8FB1B7";
        submit.style.color = "black"

        //Abfangen der Formulardaten
        var anfrageobjekt = $("form").serializeArray();

        //Erstellen eines neuen JSON mit allen nötigen Informationen
        var newIssue = {
            "date": new Date(),
            "name": anfrageobjekt[3].value,
            "mail": anfrageobjekt[4].value,
            "latitude": curLatitude,
            "longitude": curLongitude,
            "photo": anfrageobjekt[2].value,
            "type": anfrageobjekt[0].value,
            "description": anfrageobjekt[1].value,
            "behoben": false
        }
        console.log("Neuer Misstand erstellt:", newIssue);
        newIssue = JSON.stringify(newIssue);

        //Funktion zum Zurücksetzten des Submit-Buttons
        function submitReset() {
            submit.disabled = false;
            submit.innerText = 'Abschicken';
            submit.style.background = "#04AA6D";
            submit.style.color = "#ffffff"
        }

        //AJAX Anfrage zum verschicken der Fomulardaten
        $.ajax({
            type: "POST",
            contentType: "application/json",
            data: newIssue,
            url: "http://igf-srv-lehre.igf.uni-osnabrueck.de:40148/newRequest",

            //Success Callback mit einer Rückmeldung für den Benutzer
            success: function (result, status, xhr) {
                console.log("Misstand hinzufügen erfolgreich. Status:", status);
                //Das PopUp Formular wird geschlossen
                closeForm();
                //Das Success PopUpDiv wird geöffnet und nach 5 Sekunden wieder geschlossen
                document.getElementById("successDiv").style.display = "block";
                setTimeout(function () {
                    document.getElementById("successDiv").style.display = "none"
                }, 5000);
                //Der Submit-Button wird zurück gesetzt
                submitReset();
            },

            //Error Callback mit einer Rückmeldung für den Benutzer
            error: function (xhr, status_err, errormeldung) {
                console.log("Misstand hinzufügen fehlgeschlagen. Status:" + status_err + " Error: " + errormeldung);
                closeForm();
                document.getElementById("errorDiv").style.display = "block";
                setTimeout(function () {
                    document.getElementById("errorDiv").style.display = "none"
                }, 5000);
                submitReset();
            }
        });
    });

    /*************************************************************************
     * Main - Karte erzeugen und Funktionen verknüpfen                       *
     *************************************************************************/

    //Default-Standort ist Osnabrück
    var curLatitude = 52.2756;
    var curLongitude = 8.0450;

    //Variablen speichern den aktuellen Zustand der Standortzentrierung
    var currentPositionMarker;
    var centerCurrentPosition = true;
    var centerCurrentPositionControlDiv;

    //Variablen speichern die Marker für die Missstände
    var reportedGrievances;
    var reportedGrievancesMarkers;

    //Variablen speichern den aktuellen Zustand der Legende bzw des Filter der Marker
    var lControlLegend;
    var hideLegend = false;
    var grievancesCategories = {
        'object': {
            name: 'Gegenstand',
            description: 'Beeinträchtigung durch Gegenstand',
            showCategory: true
        },
        'vegetation': {
            name: 'Vegetation',
            description: 'Beeinträchtigung durch wuchernde Vegetation',
            showCategory: true
        },
        'damage': {
            name: 'Schaden',
            description: 'Schaden am Radweg',
            showCategory: true
        },
        'parking': {
            name: 'Gefahrensituation',
            description: 'Allgemeine Gefahrensituationen, wie häufig zugeparkt',
            showCategory: true
        },
        'traffic_lights': {
            name: 'Ampelschaltung',
            description: 'Ampelschaltung ungünstig',
            showCategory: true
        }
    };
    var grievancesTimeFrom = '1970-01-01';
    var today = new Date();
    var grievancesTimeTo = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    var filterGrievancesWithDates = false;
    var hideFixedGrievances = false;

    //Leaflet initializieren und OpenStreetMap-Tiles hinzufügen
    var map = L.map('mapId').setView({lon: curLongitude, lat: curLatitude}, 14);
    var basemap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'

    }).addTo(map);
    //Scale bar in der linken Ecke
    L.control.scale().addTo(map);

    //Aktuelle Position beobachten
    watchMapPosition();
    createGeolocationButton();
    map.on('dragstart', (event) => {
        updateCenterCurrentPosition(false);
    });

    //Marker und Legende für Misstände hinzufügen
    getReportedGrievances(showGrievancesMarkers);
    createMarkerFilter();

    //Darstellen des aktuellen Fomular Tabs
    var currentTab = 0; //Variable für die aktuelle Seite des Formulars
    showTab(currentTab);
}
