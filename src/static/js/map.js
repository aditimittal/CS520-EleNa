var map;
var markers;

function initAutocomplete() {
  service = new google.maps.DirectionsService;
  renderer = new google.maps.DirectionsRenderer({
    polylineOptions: {
      strokeColor: "red"
    }
  });

  var bounds = new google.maps.LatLngBounds();

  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 42.3832, lng: -72.5299 },
    zoom: 12,
    mapTypeId: "roadmap",
  });

  renderer.setMap(map);

  var source = document.getElementById("source");
  var dest = document.getElementById("dest");
  markers = new Map();
  addMarker(source, map, markers, bounds, 'source');
  addMarker(dest, map, markers, bounds, 'dest');
}

function addMarker(point, map, markers, bounds, key_val) {

    var auto = new google.maps.places.Autocomplete(point);
    auto.bindTo('bounds', map);

    google.maps.event.addListener(auto, 'place_changed', function () {
      var place = auto.getPlace();

      const icon = {
        url: place.icon,
        size: new google.maps.Size(73, 73),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(17, 34),
        scaledSize: new google.maps.Size(24, 24),
      };

      var marker = new google.maps.Marker({
        map,
        icon,
        title: place.name,
        position: place.geometry.location,
      });

      var info = new google.maps.InfoWindow();
      google.maps.event.addListener(marker, 'click', (function(marker) {
        return function() {
            info.setContent(place.name);
            info.open(map, marker);
        }
      })(marker));

      if(markers.has(key_val)) {
        markers.get(key_val).setMap(null);
        markers.delete(key_val);
      }
      markers.set(key_val, marker);
      bounds.extend(marker.position);
      map.fitBounds(bounds);

      var zoom = map.getZoom();
      map.setZoom(zoom > 12 ? 12 : zoom);
    });
}

function removeMarker() {
  initAutocomplete();

}

function removePath() {
  renderer.setDirections({routes: []});
  renderer.setMap(null);
  renderer.setPanel(null);
  service = new google.maps.DirectionsService;
  renderer = new google.maps.DirectionsRenderer({
    polylineOptions: {
      strokeColor: "red"
    }
  });
  renderer.setMap(map);
}

function reset() {
    document.getElementById("userForm").reset();
    resetStatistics();
    removeMarker();
    removePath();

}




function displayRouteonMap(path){

  var stations = []
  for (var j = 0; j < path.length; j++){
    stations.push({lat:path[j][0], lng:path[j][1]})
  }
  
  // Zoom and center map automatically by stations (each station will be in visible map area)
  var lngs = stations.map(function(station) { return station.lng; });
  var lats = stations.map(function(station) { return station.lat; });
  map.fitBounds({
      west: Math.min.apply(null, lngs),
      east: Math.max.apply(null, lngs),
      north: Math.min.apply(null, lats),
      south: Math.max.apply(null, lats),
  });

  // Show stations on the map as markers
  new google.maps.Marker({position: stations[0],map: map,});
  new google.maps.Marker({position: stations[stations.length],map: map,});
  // Divide route to several parts because max stations limit is 25 (23 waypoints + 1 origin + 1 destination)
  for (var i = 0, parts = [], max = 25 - 1; i < stations.length; i = i + max)
      parts.push(stations.slice(i, i + max + 1));

  // Service callback to process service results
  var service_callback = function(response, status) {
      if (status != 'OK') {
          console.log('Directions request failed due to ' + status);
          alert('Directions request failed due to ' + status)
          return;
      }
      renderer.setMap(map);
      renderer.setOptions({ suppressMarkers: true, preserveViewport: true });
      renderer.setDirections(response);
  };

  // Send requests to service to get route (for stations count <= 25 only one request will be sent)
  for (var i = 0; i < parts.length; i++) {
      // Waypoints does not include first station (origin) and last station (destination)
      var waypoints = [];
      for (var j = 1; j < parts[i].length - 1; j++)
          waypoints.push({location: parts[i][j], stopover: false});
      // Service options
      var service_options = {
          origin: parts[i][0],
          destination: parts[i][parts[i].length - 1],
          waypoints: waypoints,
          travelMode: 'DRIVING'
      };
      // Send request
      service.route(service_options, service_callback);
  }
}


function showPathOnMap(path, distance, gainShort, elenavDist, gainElenav) {
  var source = path[0]
  var dest = path[path.length-1]

  path_points = []
  for (let i = 3; i < path.length-3; i++){
    var lat = path[i][0];
    var long= path[i][1];
    path_points.push({
      location: new google.maps.LatLng(lat,long),
      stopover: false,
    });
  }

  service.route({
    origin: new google.maps.LatLng(source[0], source[1]),
    destination: new google.maps.LatLng(dest[0], dest[1]),
    waypoints: path_points,
    travelMode: 'WALKING'
  }, function(response, status) {
    if (status === 'OK') {
      renderer.setDirections(response);
    } else {
      window.alert('Request failed with error ' + status);
    }
  });

  setStatistics(distance, gainShort, elenavDist, gainElenav);
}


function submit(){
    var best_path;
    var validation = formValidation();

    if(validation == true) {
        initAutocomplete();
          $.ajax({
            type: "POST",
            url: "/find_route",
            data: JSON.stringify({
              source: document.getElementById("source").value,
              dest: document.getElementById("dest").value,
              algo: document.getElementById("algo").value,
              percent: document.getElementById("percent").value,
              elevationtype: document.getElementById("elevation").value
            }),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: function(result) {
              best_path = result['elevation_route']
              distance = result['shortDist']
              gainShort = result['gainShort']
              elenavDist = result['elenavDist']
              gainElenav = result['gainElenav']
              showPathOnMap(best_path, distance, gainShort, elenavDist, gainElenav);
              // displayRouteonMap(best_path)
              console.log(best_path)
            },
            error: function(result) {
                alert('Bad Request !!!');
            }
        });
    }
}



function formValidation(){
  var source = document.getElementById("source").value;
  var dest = document.getElementById("dest").value;
  var algo = document.getElementById("algo").value;
  var elevation_type = document.getElementById("elevation").value;

  if(source == "") {
    window.alert("Source Location is required.");
    return false;
  }

  if(dest == "") {
    window.alert("Destination Location is required.");
    return false;
  }

  if(algo == "Select Algorithm") {
    window.alert("Algorithm is required.");
    return false;
  }

  if(elevation_type == "Select Elevation") {
      window.alert("Elevation is required.");
      return false;
  }

  return true;
}

function setStatistics(distance, gainShort, elenavDist, gainElenav) {
  var dist = distance + elenavDist;
  var routeStats = "<h1> Route Statistics </h1> <br> Shortest Path Distance: " + distance.toFixed(4) + " m<br><br>Shortest Path Elevation gain: "+gainShort.toFixed(4) + "m<br><br>Elevation Distance: " + dist.toFixed(4) +"m<br><br>Elevation Distance gain: " + gainElenav.toFixed(4) +"m";
  document.getElementById("statistics").innerHTML = routeStats;
  document.getElementById("statistics").style["display"]='block';
  document.getElementById("map-row").classList.remove("col-lg-12");
  document.getElementById("map-row").classList.add("col-lg-9");
}

function resetStatistics() {
  document.getElementById("statistics").innerHTML = "";
  document.getElementById("statistics").style["display"]='none'
  document.getElementById("map-row").classList.remove("col-lg-9");
  document.getElementById("map-row").classList.add("col-lg-12");
}