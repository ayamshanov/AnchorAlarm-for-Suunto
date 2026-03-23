// Array of screen template names
var templates = [
  't_setup',
  't_watch',
  't_popup'
];
var currentScreenIndex = 0;

var anchorCoordinates = null;
var alarmActive = false; // prevents re-triggering while already in alarm state

var COORD_DIVIDER = 10000000;

// Haversine formula: returns distance in meters between two GPS points
var calcDistance = function(lat1, lon1, lat2, lon2) {
  var R = 6371000; // Earth radius in meters
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// System starts calling this ~1/sec as soon as the sports app screen is entered.
var computeRelBearing = function(lat, lon, anchorLat, anchorLon, headingDeg) {
  var dLon = (anchorLon - lon) * Math.PI / 180;
  var latR = lat * Math.PI / 180;
  var anchorLatR = anchorLat * Math.PI / 180;
  var x = Math.sin(dLon) * Math.cos(anchorLatR);
  var y = Math.cos(latR) * Math.sin(anchorLatR) - Math.sin(latR) * Math.cos(anchorLatR) * Math.cos(dLon);
  var bearing = Math.atan2(x, y) * 180 / Math.PI;
  var bearingToAnchorDeg = (Math.round((bearing + 360) % 360));
  return (bearingToAnchorDeg - headingDeg + 360) % 360;
}

function evaluate(input, output) {
  if (output.watchState === 1) {
    if (anchorCoordinates && input.GeoCoordinates && input.gpsReadiness === 100) {
      setText("#pausedStr", " ");
      var lat = input.GeoCoordinates.latitude / COORD_DIVIDER;
      var lon = input.GeoCoordinates.longitude / COORD_DIVIDER;
      var headingDeg = input.Heading * 180 / Math.PI;
      var anchorLat = anchorCoordinates.latitude;
      var anchorLon = anchorCoordinates.longitude;

      output.distanceToAnchor = Math.round(calcDistance(lat, lon, anchorLat, anchorLon));
      output.relBearingToAnchor = computeRelBearing(lat, lon, anchorLat, anchorLon, headingDeg);

      // Check if boat has drifted beyond alarm radius
      if (output.distanceToAnchor > output.alarmRadius) {
        if (!alarmActive) {
          alarmActive = true;
          output.alarmCount += 1;
          // Trigger alert sound and switch to popup screen
          playIndication("Confirm");
          currentScreenIndex = 2;
          unload("_cm");
        }
      } else {
        // Back within safe zone — reset so next breach triggers alarm again
        alarmActive = false;
      }
    } else {
      setText("#pausedStr", "NO GPS");
      output.distanceToAnchor = null;
      output.relBearingToAnchor = null; 
    }
  } else if (output.watchState === 2) {
    setText("#pausedStr", "PAUSED");
    output.distanceToAnchor = null;
    output.relBearingToAnchor = null;
  }
}

// main.js loaded and system starts calling evaluate()
function onLoad(input, output) {
    output.alarmRadius = 50; // Default alarm radius in meters
    output.watchState = 0;  // 0 = no watch, 1 = watching, 2 = paused
    output.distanceToAnchor = null;
    output.relBearingToAnchor = null;
    output.alarmCount = 0;
}

function getUserInterface() {
  return {
    template: templates[currentScreenIndex]
  };
}

// Handles events from pushButton HTML element
function onEvent(input, output, eventId) {
  switch (eventId) {
    case 1:     // start / pause / resume
      if (output.watchState === 0) {
        if (input.GeoCoordinates) {
          anchorCoordinates = {
            latitude: input.GeoCoordinates.latitude / COORD_DIVIDER,
            longitude: input.GeoCoordinates.longitude / COORD_DIVIDER
          };
        }
        output.watchState = 1;
        playIndication("StartTimer");
        currentScreenIndex = 1;
        unload("_cm");
      } else if (output.watchState === 1) {
        // Pause watch
        output.watchState = 2;
        playIndication("StopTimer");
      } else if (output.watchState === 2) {
        // Resume watch
        output.watchState = 1;
        playIndication("StartTimer");
      }
      break;
    case 2:     // Top button long press — reset watch, clear anchor and all data, return to setup
      output.watchState = 0;
      playIndication("StopTimer");
      anchorCoordinates = null;
      alarmActive = false;
      currentScreenIndex = 0;
      unload("_cm");
      break;
    case 3:       // Bottom button pressed — decrease alarm radius
      if (output.alarmRadius > 10) {
        output.alarmRadius -= 10;
      }
      break;
    case 4:       // Bottom button long press — increase alarm radius
      output.alarmRadius += 10;
      break;
    case 5:       // Popup button — return to watch screen
    case 6:
      currentScreenIndex = 1;
      unload("_cm");
      break;
  }
}