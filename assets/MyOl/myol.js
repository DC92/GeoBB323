/* OPENLAYERS V5 ADAPTATION - https://openlayers.org/
 * (C) Dominique Cavailhez 2017
 * https://github.com/Dominique92/MyOl
 *
 * I have designed this openlayers adaptation as simple as possible to make it maintained with basics JS skills
 * You only have to include openlayers/dist.js & .css files & myol.js & .css & that's it !
 * You can use any of these functions independantly (except documented dependencies)
 * No JS classes, no jquery, no es6 modules, no nodejs build, no minification, no npm repository, ... only one file of JS functions & CSS
 * I know, I know, it's not a modern programming method but it's my choice & you're free to take, modifiy & adapt it as you wish
 */
/* jshint esversion: 6 */
//TODO WRI NAV PRC + C2C direct
//TODO WRI NAV OSM Hôtels et locations, camping Campings, ravitaillement Alimentation, parking Parkings, arrêt de bus Bus
//TODO WRI EDIT édition massifs sans couper
//TODO BEST collect all languages in a single place
ol.Map.prototype.renderFrame_ = function(time) {
	//HACK add map_ to each layer
	const map = this;
	map.getLayers().forEach(function(target) {
		target.map_ = map;
	});

	//TODO hack to centralize pointermove à forEachFeatureAtPixel
	return ol.PluggableMap.prototype.renderFrame_.call(this, time);
};

//HACK log json parsing errors
function JSONparse(json) {
	try {
		return JSON.parse(json);
	} catch (returnCode) {
		console.log(returnCode + ' parsing : "' + json + '" ' + new Error().stack);
	}
}

/**
 * TILE LAYERS
 */
/**
 * Openstreetmap
 */
function layerOSM(url, attribution, maxZoom) {
	return new ol.layer.Tile({
		source: new ol.source.XYZ({
			url: url,
			maxZoom: maxZoom || 21,
			attributions: [
				attribution || '',
				ol.source.OSM.ATTRIBUTION,
			],
		}),
	});
}

/**
 * Kompas (Austria)
 * Requires layerOSM
 */
function layerKompass(layer) {
	return layerOSM(
		'http://ec{0-3}.cdn.ecmaps.de/WmsGateway.ashx.jpg?' + // Not available via https
		'Experience=ecmaps&MapStyle=' + layer + '&TileX={x}&TileY={y}&ZoomLevel={z}',
		'<a href="http://www.kompass.de/livemap/">KOMPASS</a>'
	);
}

/**
 * Thunderforest
 * Requires layerOSM
 * Get your own (free) THUNDERFOREST key at https://manage.thunderforest.com
 */
function layerThunderforest(key, layer) {
	return layerOSM(
		'//{a-c}.tile.thunderforest.com/' + layer + '/{z}/{x}/{y}.png?apikey=' + key,
		'<a href="http://www.thunderforest.com">Thunderforest</a>'
	);
}

/**
 * Google
 */
function layerGoogle(layer) {
	return new ol.layer.Tile({
		source: new ol.source.XYZ({
			url: '//mt{0-3}.google.com/vt/lyrs=' + layer + '&hl=fr&x={x}&y={y}&z={z}',
			attributions: '&copy; <a href="https://www.google.com/maps">Google</a>',
		})
	});
}

/**
 * Stamen http://maps.stamen.com
 */
function layerStamen(layer) {
	return new ol.layer.Tile({
		source: new ol.source.Stamen({
			layer: layer,
		})
	});
}

/**
 * IGN France
 * Doc on http://api.ign.fr
 * Get your own (free) IGN key at http://professionnels.ign.fr/user
 */
function layerIGN(key, layer, format) {
	let IGNresolutions = [],
		IGNmatrixIds = [];
	for (let i = 0; i < 18; i++) {
		IGNresolutions[i] = ol.extent.getWidth(ol.proj.get('EPSG:3857').getExtent()) / 256 / Math.pow(2, i);
		IGNmatrixIds[i] = i.toString();
	}
	return new ol.layer.Tile({
		source: new ol.source.WMTS({
			url: '//wxs.ign.fr/' + key + '/wmts',
			layer: layer,
			matrixSet: 'PM',
			format: 'image/' + (format || 'jpeg'),
			tileGrid: new ol.tilegrid.WMTS({
				origin: [-20037508, 20037508],
				resolutions: IGNresolutions,
				matrixIds: IGNmatrixIds,
			}),
			style: 'normal',
			attributions: '&copy; <a href="http://www.geoportail.fr/" target="_blank">IGN</a>',
		})
	});
}

/**
 * Spain
 */
function layerSpain(serveur, layer) {
	return new ol.layer.Tile({
		source: new ol.source.XYZ({
			url: '//www.ign.es/wmts/' + serveur + '?layer=' + layer +
				'&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg' +
				'&style=default&tilematrixset=GoogleMapsCompatible' +
				'&TileMatrix={z}&TileCol={x}&TileRow={y}',
			attributions: '&copy; <a href="http://www.ign.es/">IGN España</a>',
		})
	});
}

/**
 * Layers with not all resolutions or area available
 * Virtual class
 * Displays Stamen outside the layer zoom range or extend
 * Requires HACK map_
 */
function layerTileIncomplete(options) {
	const layer = options.extraLayer || layerStamen('terrain');
	options.sources[999999] = layer.getSource(); // Add extrabound source on the top of the list

	layer.once('prerender', function() {
		if (typeof options.addSources == 'function')
			options.sources = Object.assign(
				options.sources,
				options.addSources()
			);
		layer.map_.getView().on('change:resolution', change);
		change(); // At init
	});

	// Zoom has changed
	function change() {
		const view = layer.map_.getView();
		let currentResolution = 999999; // Init loop at max resolution

		// Search for sources according to the map resolution
		if (ol.extent.intersects(options.extent, view.calculateExtent(layer.map_.getSize())))
			currentResolution = Object.keys(options.sources).filter(function(evt) { //HACK : use of filter to perform an action
				return evt > view.getResolution();
			})[0];

		// Update layer if necessary
		if (layer.getSource() != options.sources[currentResolution])
			layer.setSource(options.sources[currentResolution]);
	}
	return layer;
}

/**
 * Swisstopo https://api.geo.admin.ch/
 * Register your domain: https://shop.swisstopo.admin.ch/fr/products/geoservice/swisstopo_geoservices/WMTS_info
 * Requires layerTileIncomplete
 */
function layerSwissTopo(layer, extraLayer) {
	const projectionExtent = ol.proj.get('EPSG:3857').getExtent();
	let resolutions = [],
		matrixIds = [];
	for (let r = 0; r < 18; ++r) {
		resolutions[r] = ol.extent.getWidth(projectionExtent) / 256 / Math.pow(2, r);
		matrixIds[r] = r;
	}
	return layerTileIncomplete({
		extraLayer: extraLayer,
		extent: [664577, 5753148, 1167741, 6075303], // EPSG:21781
		sources: {
			500: new ol.source.WMTS(({
				crossOrigin: 'anonymous',
				url: '//wmts2{0-4}.geo.admin.ch/1.0.0/' + layer + '/default/current/3857/{TileMatrix}/{TileCol}/{TileRow}.jpeg',
				tileGrid: new ol.tilegrid.WMTS({
					origin: ol.extent.getTopLeft(projectionExtent),
					resolutions: resolutions,
					matrixIds: matrixIds,
				}),
				requestEncoding: 'REST',
				attributions: '&copy <a href="https://map.geo.admin.ch/">SwissTopo</a>',
			}))
		},
	});
}

/**
 * Italy IGM
 * Requires layerTileIncomplete
 */
function layerIGM() {
	function igmSource(url, layer) {
		return new ol.source.TileWMS({
			url: 'http://wms.pcn.minambiente.it/ogc?map=/ms_ogc/WMS_v1.3/raster/' + url + '.map',
			params: {
				layers: layer,
			},
			attributions: '&copy <a href="http://www.pcn.minambiente.it/viewer">IGM</a>',
		});
	}
	return layerTileIncomplete({
		extent: [660124, 4131313, 2113957, 5958411], // EPSG:6875 (Italie)
		sources: {
			100: igmSource('IGM_250000', 'CB.IGM250000'),
			25: igmSource('IGM_100000', 'MB.IGM100000'),
			5: igmSource('IGM_25000', 'CB.IGM25000'),
		},
	});
}

/**
 * Ordnance Survey : Great Britain
 * Requires layerTileIncomplete
 * Get your own (free) key at http://www.ordnancesurvey.co.uk/business-and-government/products/os-openspace/
 */
function layerOS(key) {
	return layerTileIncomplete({
		extent: [-841575, 6439351, 198148, 8589177], // EPSG:27700 (G.B.)
		sources: {},
		addSources: function() { //HACK : Avoid to call https://dev.virtualearth.net/... if no bing layer is required
			return {
				75: new ol.source.BingMaps({
					imagerySet: 'OrdnanceSurvey',
					key: key,
				})
			};
		},
	});
}

/**
 * Bing (Microsoft)
 * Get your own (free) BING key at https://www.microsoft.com/en-us/maps/create-a-bing-maps-key
 */
function layerBing(key, subLayer) {
	const layer = new ol.layer.Tile();

	//HACK : Avoid to call https://dev.virtualearth.net/... if no bing layer is required
	layer.once('change:opacity', function() {
		if (layer.getVisible() && !layer.getSource()) {
			layer.setSource(new ol.source.BingMaps({
				imagerySet: subLayer,
				key: key,
			}));
		}
	});
	return layer;
}


/**
 * VECTORS, GEOJSON & AJAX LAYERS
 */
// Mem in cookies the checkbox content with name="selectorName"
function controlPermanentCheckbox(selectorName, callback) {
	const checkEls = document.getElementsByName(selectorName),
		cookie = location.hash.match('map-' + selectorName + '=([^#,&;]*)') || // Priority to the hash
		document.cookie.match('map-' + selectorName + '=([^;]*)'); // Then the cookie

	for (let e = 0; e < checkEls.length; e++) {
		checkEls[e].addEventListener('click', permanentCheckboxClick); // Attach the action
		if (cookie) // Set the checks accordingly with the cookie
			checkEls[e].checked = cookie[1].split(',').indexOf(checkEls[e].value) !== -1;
	}

	function permanentCheckboxClick(evt) {
		if (typeof callback == 'function')
			callback(evt, permanentCheckboxList(selectorName, evt));
	}
	callback(null, permanentCheckboxList(selectorName)); // Call callback once at the init
}

// Global functions
function permanentCheckboxList(selectorName, evt) {
	const checkEls = document.getElementsByName(selectorName);
	let allChecks = [];

	for (let e = 0; e < checkEls.length; e++) {
		// Select/deselect all (clicking an <input> without value)
		if (evt) {
			if (evt.target.value == 'on') // The Select/deselect has a default value = "on"
				checkEls[e].checked = evt.target.checked; // Check all if "all" is clicked
			else if (checkEls[e].value == 'on')
				checkEls[e].checked = false; // Reset the "all" checks if another check is clicked
		}

		// Get status of all checks
		if (checkEls[e].checked) // List checked elements
			allChecks.push(checkEls[e].value);
	}
	// Mem the related cookie / Keep empty one to keep memory of cancelled subchoices
	document.cookie = 'map-' + selectorName + '=' + allChecks.join(',') + ';path=/;SameSite=Strict';
	return allChecks; // Returns list of checked values or ids
}

function escapedStyle(a, b) {
	const defaultStyle = new ol.layer.Vector().getStyleFunction()()[0];
	return function(feature) {
		return new ol.style.Style(Object.assign({
				fill: defaultStyle.getFill(),
				stroke: defaultStyle.getStroke(),
				image: defaultStyle.getImage(),
			},
			typeof a == 'function' ? a(feature.getProperties()) : a,
			typeof b == 'function' ? b(feature.getProperties()) : b
		));
	};
}

/**
 * BBOX strategy when the url return a limited number of features depending on the extent
 */
ol.loadingstrategy.bboxLimit = function(extent, resolution) {
	if (this.bboxLimitResolution > resolution) // When zoom in
		this.loadedExtentsRtree_.clear(); // Force the loading of all areas
	this.bboxLimitResolution = resolution; // Mem resolution for further requests
	return [extent];
};

/**
 * GeoJson POI layer
 * Requires controlPermanentCheckbox, JSONparse, HACK map_
 * permanentCheckboxList, loadingStrategyBboxLimit & escapedStyle
 */
function layerVectorURL(o) {
	const options = Object.assign({
			baseUrlFunction: function(bbox, list) {
				return options.baseUrl + // baseUrl is mandatory, no default
					list.join(',') + '&bbox=' + bbox.join(','); // Default most common url format
			},
		}, o),
		popEl = window.popEl_ = document.createElement('a'),
		popup = window.popup_ = //HACK attach these to windows to define only one
		new ol.Overlay({
			element: popEl,
		}),
		format = new ol.format.GeoJSON(),
		source = new ol.source.Vector(Object.assign({
			url: function(extent, resolution, projection) {
				const bbox = ol.proj.transformExtent(extent, projection.getCode(), 'EPSG:4326'),
					// Retreive checked parameters
					list = permanentCheckboxList(options.selectorName).filter(function(evt) { // selectorName optional
						return evt !== 'on'; // Remove the "all" input (default value = "on")
					});
				return options.baseUrlFunction(bbox, list, resolution);
			},
			format: format, //new ol.format.GeoJSON(),
		}, options)),
		layer = new ol.layer.Vector(Object.assign({
			source: source,
			style: escapedStyle(options.styleOptions),
			renderBuffer: 16, // buffered area around curent view (px)
			zIndex: 1, // Above the baselayer even if included to the map before
		}, options));

	// HACK to clear the layer when the xhr response is received
	// This needs to be redone every time a response is received to avoid multiple simultaneous xhr requests
	format.readFeatures = function(response, options) {
		if (source.bboxLimitResolution) // If bbbox optimised
			source.clear(); // Clean all features when receiving a request
		JSONparse(response); // Report json error if any
		return ol.format.GeoJSON.prototype.readFeatures.call(this, response, options);
	};

	// Checkboxes to tune layer parameters
	if (options.selectorName)
		controlPermanentCheckbox(
			options.selectorName,
			function(evt, list) {
				layer.setVisible(list.length);
				if (list.length && source.loadedExtentsRtree_) {
					source.loadedExtentsRtree_.clear(); // Force the loading of all areas
					source.clear(); // Redraw the layer
				}
			}
		);

	layer.once('prerender', function(evt) {
		const map = evt.target.map_;
		map.addOverlay(popup);
		map.on('pointermove', pointerMove);
		map.on('click', function(evtClk) { // Click on a feature
			evtClk.target.forEachFeatureAtPixel(
				evtClk.pixel,
				function() {
					if (popup.getPosition())
						popEl.click(); // Simulate a click on the label
				}
			);
		});

		//TODO BEST zoom map when the cursor is over a label
		// Style when hovering a feature
		map.addInteraction(new ol.interaction.Select({
			condition: ol.events.condition.pointerMove,
			hitTolerance: 6,
			filter: function(feature, l) {
				return l == layer;
			},
			style: escapedStyle(options.styleOptions, options.hoverStyleOptions),
		}));

		// Hide popup when the cursor is out of the map
		window.addEventListener('mousemove', function(evtMm) {
			const divRect = map.getTargetElement().getBoundingClientRect();
			if (evtMm.clientX < divRect.left || evtMm.clientX > divRect.right ||
				evtMm.clientY < divRect.top || evtMm.clientY > divRect.bottom)
				popup.setPosition();
		});
	});

	function pointerMove(evt) {
		const map = evt.target;
		let pixel = [evt.pixel[0], evt.pixel[1]];

		// Hide label by default if none feature or his popup here
		const mapRect = map.getTargetElement().getBoundingClientRect(),
			popupRect = popEl.getBoundingClientRect();
		if (popupRect.left - 5 > mapRect.left + evt.pixel[0] || mapRect.left + evt.pixel[0] >= popupRect.right + 5 ||
			popupRect.top - 5 > mapRect.top + evt.pixel[1] || mapRect.top + evt.pixel[1] >= popupRect.bottom + 5 ||
			!popupRect)
			popup.setPosition();

		// Reset cursor if there is no feature here
		map.getViewport().style.cursor = 'default';

		map.forEachFeatureAtPixel(
			pixel,
			function(feature_, layer_) {
				if (layer_ && typeof layer_.displayPopup == 'function')
					layer_.displayPopup(feature_, pixel);
			}, {
				hitTolerance: 6,
			}
		);
	}

	layer.displayPopup = function(feature, pixel) {
		const map = layer.map_;
		let geometry = feature.getGeometry();
		if (typeof feature.getGeometry().getGeometries == 'function') // GeometryCollection
			geometry = geometry.getGeometries()[0];

		if (layer && options) {
			const properties = feature.getProperties(),
				coordinates = geometry.flatCoordinates, // If it's a point, just over it
				ll4326 = ol.proj.transform(coordinates, 'EPSG:3857', 'EPSG:4326');
			if (coordinates.length == 2) // Stable if icon
				pixel = map.getPixelFromCoordinate(coordinates);

			// Hovering label
			const label = typeof options.label == 'function' ?
				options.label(properties, feature) :
				options.label || '',
				postLabel = typeof options.postLabel == 'function' ?
				options.postLabel(properties, feature, layer, pixel, ll4326) :
				options.postLabel || '';

			if (label && !popup.getPosition()) { // Only for the first feature on the hovered stack
				// Calculate the label's anchor
				popup.setPosition(map.getView().getCenter()); // For popup size calculation

				// Fill label class & text
				popEl.className = 'myPopup ' + (options.labelClass || '');
				popEl.innerHTML = label + postLabel;
				if (typeof options.href == 'function') {
					popEl.href = options.href(properties);
					map.getViewport().style.cursor = 'pointer';
				}

				// Shift of the label to stay into the map regarding the pointer position
				if (pixel[1] < popEl.clientHeight + 12) { // On the top of the map (not enough space for it)
					pixel[0] += pixel[0] < map.getSize()[0] / 2 ? 10 : -popEl.clientWidth - 10;
					pixel[1] = 2;
				} else {
					pixel[0] -= popEl.clientWidth / 2;
					pixel[0] = Math.max(pixel[0], 0); // Bord gauche
					pixel[0] = Math.min(pixel[0], map.getSize()[0] - popEl.clientWidth - 1); // Bord droit
					pixel[1] -= popEl.clientHeight + 8;
				}
				popup.setPosition(map.getCoordinateFromPixel(pixel));
			}
		}
	};
	return layer;
}

/**
 * OSM overpass POI layer
 * From: https://openlayers.org/en/latest/examples/vector-osm.html
 * Doc: http://wiki.openstreetmap.org/wiki/Overpass_API/Language_Guide
 * Requires layerVectorURL
 */
//TODO OVERPASS IE BUG don't work on IE
//TODO OVERPASS BEST display error 429 (Too Many Requests)
//TODO BUG don't work on examples/index
layerOverpass = function(o) {
	const options = Object.assign({
			baseUrl: '//overpass-api.de/api/interpreter',
			maxResolution: 30, // Only call overpass if the map's resolution is lower
			selectorId: 'overpass', // Element containing all checkboxes
			selectorName: 'overpass', // Checkboxes
			labelClass: 'label-overpass',
			iconUrlPath: '//dc9.fr/chemineur/ext/Dominique92/GeoBB/types_points/',
		}, o),
		checkEls = document.getElementsByName(options.selectorName),
		elSelector = document.getElementById(options.selectorId);
	elSelector.className = 'overpass'; // At the biginning

	// Convert areas into points to display it as an icon
	const osmXmlPoi = new ol.format.OSMXML();
	osmXmlPoi.readFeatures = function(source) { //HACK  to modify the format
		for (let node = source.documentElement.firstChild; node; node = node.nextSibling)
			if (node.nodeName == 'way') {
				// Create a new 'node' element centered on the surface
				const newNode = source.createElement('node');
				source.documentElement.appendChild(newNode);
				newNode.id = node.id;

				// Add a tag to mem what node type it was
				const newTag = source.createElement('tag');
				newTag.setAttribute('k', 'nodetype');
				newTag.setAttribute('v', 'way');
				newNode.appendChild(newTag);

				for (let subTagNode = node.firstChild; subTagNode; subTagNode = subTagNode.nextSibling)
					switch (subTagNode.nodeName) {
						case 'center':
							newNode.setAttribute('lon', subTagNode.getAttribute('lon'));
							newNode.setAttribute('lat', subTagNode.getAttribute('lat'));
							newNode.setAttribute('nodeName', subTagNode.nodeName);
							break;
						case 'tag':
							newNode.appendChild(subTagNode.cloneNode());
					}
			}
		return ol.format.OSMXML.prototype.readFeatures.call(this, source, options);
	};

	function overpassType(properties) {
		for (let e = 0; e < checkEls.length; e++)
			if (checkEls[e].checked) {
				const tags = checkEls[e].value.split('+');
				for (let t = 0; t < tags.length; t++) {
					const conditions = tags[t].split('"');
					if (properties[conditions[1]] &&
						properties[conditions[1]].match(conditions[3]))
						return checkEls[e].id;
				}
			}
		return 'inconnu';
	}

	return layerVectorURL(Object.assign({
		format: osmXmlPoi,
		strategy: ol.loadingstrategy.bbox,
		styleOptions: function(properties) {
			return {
				image: new ol.style.Icon({
					src: options.iconUrlPath + overpassType(properties) + '.png'
				})
			};
		},
		baseUrlFunction: function(bbox, list, resolution) {
			const bb = '(' + bbox[1] + ',' + bbox[0] + ',' + bbox[3] + ',' + bbox[2] + ');',
				args = [];

			if (resolution < (options.maxResolution)) { // Only for small areas
				for (let l = 0; l < list.length; l++) {
					const lists = list[l].split('+');
					for (let ls = 0; ls < lists.length; ls++)
						args.push(
							'node' + lists[ls] + bb + // Ask for nodes in the bbox
							'way' + lists[ls] + bb // Also ask for areas
						);
				}
				if (elSelector)
					elSelector.className = 'overpass';
			} else if (elSelector)
				elSelector.className = 'overpass-zoom-out';

			return options.baseUrl +
				'?data=[timeout:5];(' + // Not too much !
				args.join('') +
				');out center;'; // add center of areas
		},
		label: function(p, f) { // properties, feature
			p.name = p.name || p.alt_name || p.short_name || '';
			const language = {
					alpine_hut: 'Refuge gard&egrave;',
					hotel: 'h&ocirc;tel',
					guest_house: 'chambre d‘h&ocirc;te',
					camp_site: 'camping',
					convenience: 'alimentation',
					supermarket: 'supermarch&egrave;',
					drinking_water: 'point d&apos;eau',
					watering_place: 'abreuvoir',
					fountain: 'fontaine',
					telephone: 't&egrave;l&egrave;phone',
					shelter: ''
				},
				phone = p.phone || p['contact:phone'],
				address = [
					p.address,
					p['addr:housenumber'], p.housenumber,
					p['addr:street'], p.street,
					p['addr:postcode'], p.postcode,
					p['addr:city'], p.city
				],
				popup = [
					'<b>' + p.name.charAt(0).toUpperCase() + p.name.slice(1) + '</b>', [
						'<a target="_blank"',
						'href="http://www.openstreetmap.org/' + (p.nodetype ? p.nodetype : 'node') + '/' + f.getId() + '"',
						'title="Voir la fiche d‘origine sur openstreetmap">',
						p.name ? (
							p.name.toLowerCase().match(language[p.tourism] || 'azertyuiop') ? '' : p.tourism
							//TODO OVERPASS BUG don't recognize accented letters (hôtel)
						) : (
							language[p.tourism] || p.tourism
						),
						'*'.repeat(p.stars),
						p.shelter_type == 'basic_hut' ? 'Abri' : '',
						p.building == 'cabin' ? 'Cabane non gard&egrave;e' : '',
						p.highway == 'bus_stop' ? 'Arr&ecirc;t de bus' : '',
						p.waterway == 'water_point' ? 'Point d&apos;eau' : '',
						p.natural == 'spring' ? 'Source' : '',
						p.man_made == 'water_well' ? 'Puits' : '',
						p.shop ? 'alimentation' : '',
						typeof language[p.amenity] == 'string' ? language[p.amenity] : p.amenity,
						'</a>'
					].join(' '), [
						p.rooms ? p.rooms + ' chambres' : '',
						p.beds ? p.beds + ' lits' : '',
						p.place ? p.place + ' places' : '',
						p.capacity ? p.capacity + ' places' : '',
						p.ele ? parseInt(p.ele, 10) + 'm' : ''
					].join(' '),
					phone ? '&phone;<a title="Appeler" href="tel:' + phone.replace(/[^0-9+]+/ig, '') + '">' + phone + '</a>' : '',
					p.email ? '&#9993;<a title="Envoyer un mail" href="mailto:' + p.email + '">' + p.email + '</a>' : '',
					p['addr:street'] ? address.join(' ') : '',
					p.website ? '&#8943;<a title="Voir le site web" target="_blank" href="' + p.website + '">' + (p.website.split('/')[2] || p.website) + '</a>' : '',
					p.opening_hours ? 'ouvert ' + p.opening_hours : '',
					p.note ? p.note : ''
				];

			// Other paramaters
			const done = [ // These that have no added value or already included
				'geometry,lon,lat,area,amenity,building,highway,shop,shelter_type,access,waterway,natural,man_made',
				'tourism,stars,rooms,place,capacity,ele,phone,contact,url,nodetype,name,alt_name,email,website',
				'opening_hours,description,beds,bus,note',
				'addr,housenumber,street,postcode,city,bus,public_transport,tactile_paving',
				'ref,source,wheelchair,leisure,landuse,camp_site,bench,network,brand,bulk_purchase,organic',
				'compressed_air,fuel,vending,vending_machine',
				'fee,heritage,wikipedia,wikidata,operator,mhs,amenity_1,beverage,takeaway,delivery,cuisine',
				'historic,motorcycle,drying,restaurant,hgv',
				'drive_through,parking,park_ride,supervised,surface,created_by,maxstay'
			].join(',').split(',');
			let nbInternet = 0;
			for (let k in p) {
				const k0 = k.split(':')[0];
				if (!done.includes(k0))
					switch (k0) {
						case 'internet_access':
							if ((p[k] != 'no') && !(nbInternet++))
								popup.push('Accès internet');
							break;
						default:
							popup.push(k + ' : ' + p[k]);
					}
			}
			return ('<p>' + popup.join('</p><p>') + '</p>').replace(/<p>\s*<\/p>/ig, '');
		},
	}, options));
};

/**
 * Marker
 * Requires JSONparse, HACK map_, proj4.js for swiss coordinates
 * Read / write following fields :
 * marker-json : {"type":"Point","coordinates":[2.4,47.082]}
 * marker-lon / marker-lat
 * marker-x / marker-y : CH 1903 (wrapped with marker-xy)
 */
//TODO BEST Change cursor while hovering the target but there may be a conflict of forEachFeatureAtPixel with another function
function layerMarker(o) {
	const options = Object.assign({
			llInit: [],
			idDisplay: 'marker',
			decimalSeparator: '.',
		}, o),
		elJson = document.getElementById(options.idDisplay + '-json'),
		elLon = document.getElementById(options.idDisplay + '-xy'),
		elLat = document.getElementById(options.idDisplay + '-xy'),
		elXY = document.getElementById(options.idDisplay + '-xy');

	// Use json field values if any
	if (elJson) {
		let json = elJson.value || elJson.innerHTML;
		if (json)
			options.llInit = JSONparse(json).coordinates;
	}
	// Use lon-lat fields values if any
	if (elLon && elLat) {
		const lon = parseFloat(elLon.value || elLon.innerHTML),
			lat = parseFloat(elLat.value || elLat.innerHTML);
		if (lon && lat)
			options.llInit = [lon, lat];
	}

	// The marker layer
	const style = new ol.style.Style({
			image: new ol.style.Icon(({
				src: options.imageUrl,
				anchor: [0.5, 0.5],
			}))
		}),
		point = new ol.geom.Point(
			ol.proj.fromLonLat(options.llInit)
		),
		feature = new ol.Feature({
			geometry: point
		}),
		source = new ol.source.Vector({
			features: [feature]
		}),
		layer = new ol.layer.Vector({
			source: source,
			style: style,
			zIndex: 10
		}),
		format = new ol.format.GeoJSON();

	layer.once('prerender', function() {
		if (options.dragged) {
			// Drag and drop
			layer.map_.addInteraction(new ol.interaction.Modify({
				features: new ol.Collection([feature]),
				style: style
			}));
			point.on('change', function() {
				displayLL(point.getCoordinates());
			});
		}
	});

	// <input> coords edition
	feildEdit = function(evt) {
		const id = evt.target.id.split('-')[1], // Get second part of the field id
			pars = {
				lon: [0, 4326],
				lat: [1, 4326],
				x: [0, 21781],
				y: [1, 21781],
			},
			nol = pars[id][0], // Get what coord is concerned (x, y)
			projection = pars[id][1]; // Get what projection is concerned
		let coord = ol.proj.transform(point.getCoordinates(), 'EPSG:3857', 'EPSG:' + projection); // Get initial position
		coord[nol] = parseFloat(evt.target.value.replace(',', '.')); // We change the value that was edited
		point.setCoordinates(ol.proj.transform(coord, 'EPSG:' + projection, 'EPSG:3857')); // Set new position

		// Center map to the new position
		layer.map_.getView().setCenter(point.getCoordinates());
	};

	// Display a coordinate
	//TODO BEST dispach/edit deg min sec
	function displayLL(ll) {
		const ll4326 = ol.proj.transform(ll, 'EPSG:3857', 'EPSG:4326'),
			values = {
				lon: (Math.round(ll4326[0] * 100000) / 100000).toString().replace('.', options.decimalSeparator),
				lat: (Math.round(ll4326[1] * 100000) / 100000).toString().replace('.', options.decimalSeparator),
				json: JSON.stringify(format.writeGeometryObject(point, {
					featureProjection: 'EPSG:3857',
					decimals: 5
				}))
			};

		// Specific Swiss coordinates EPSG:21781 (CH1903 / LV03)
		if (typeof proj4 == 'function') {
			proj4.defs('EPSG:21781', '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=660.077,13.551,369.344,2.484,1.783,2.939,5.66 +units=m +no_defs');
			ol.proj.proj4.register(proj4);
		}
		// Specific Swiss coordinates EPSG:21781 (CH1903 / LV03)
		//TODO load proj4 from server when required & wait onload
		if (typeof proj4 == 'function' &&
			ol.extent.containsCoordinate([664577, 5753148, 1167741, 6075303], ll)) { // Si on est dans la zone suisse EPSG:21781
			const c21781 = ol.proj.transform(ll, 'EPSG:3857', 'EPSG:21781');
			values.x = Math.round(c21781[0]);
			values.y = Math.round(c21781[1]);
		}
		if (elXY) // Mask full xy if nothing to write
			elXY.style.display = values.x && values.y ? '' : 'none';

		// We insert the resulting HTML string where it is going
		for (let postId in values) {
			const el = document.getElementById(options.idDisplay + '-' + postId);
			if (el) {
				el.onchange = feildEdit; // Set the change function
				if (el.value !== undefined)
					el.value = values[postId];
				else
					el.innerHTML = values[postId];
			}
		}
	}
	displayLL(ol.proj.fromLonLat(options.llInit)); // Display once at init

	layer.getPoint = function() {
		return point;
	};
	return layer;
}


/**
 * CONTROLS
 */
/**
 * Control button
 * Abstract definition to be used by other control buttons definitions
 */
var nextButtonPos = 2.5; // Top position of next button (em)

function controlButton(o) {
	const buttonEl = document.createElement('button'),
		options = Object.assign({
			element: document.createElement('div'),
			buttonBackgroundColors: ['white'],
			stateNumber: 2,
		}, o),
		control = new ol.control.Control(options);

	control.element.appendChild(buttonEl);
	control.element.className = 'ol-button ol-unselectable ol-control ' + options.className;
	control.element.title = options.title; // {string} displayed when the control is hovered.
	if (options.className) {
		if (options.rightPosition) { // {float} distance to the top when the button is on the right of the map
			control.element.style.top = options.rightPosition + 'em';
			control.element.style.right = '.5em';
		} else {
			control.element.style.top = '.5em';
			control.element.style.left = (nextButtonPos += 2) + 'em';
		}
	}
	buttonEl.addEventListener('click', function(evt) {
		evt.preventDefault();
		control.toggle();
	});

	// Toggle the button status & aspect
	control.active = 0;
	control.toggle = function(newActive, group) {
		// Toggle by default
		if (typeof newActive == 'undefined')
			newActive = (control.active + 1) % options.stateNumber;

		// Unselect all other controlButtons from the same group
		if (newActive && options.group)
			control.getMap().getControls().forEach(function(c) {
				if (c != control &&
					typeof c.toggle == 'function') // Only for controlButtons
					c.toggle(0, options.group);
			});

		// Execute the requested change
		if (control.active != newActive &&
			(!group || group == options.group)) { // Only for the concerned controls
			control.active = newActive;
			buttonEl.style.backgroundColor = options.buttonBackgroundColors[newActive % options.buttonBackgroundColors.length];
			options.activate(newActive);
		}
	};
	return control;
}

/**
 * Layer switcher control
 * baseLayers {[ol.layer]} layers to be chosen one to fill the map.
 * Requires controlButton, controlPermanentCheckbox & permanentCheckboxList
 */
function controlLayersSwitcher(options) {
	const button = controlButton({
		className: 'ol-switch-layer',
		title: 'Liste des cartes',
		rightPosition: 0.5,
	});

	// Transparency slider (first position)
	const rangeEl = document.createElement('input');
	rangeEl.type = 'range';
	rangeEl.className = 'range-layer';
	rangeEl.oninput = displayLayerSelector;
	rangeEl.title = 'Glisser pour faire varier la tranparence';
	button.element.appendChild(rangeEl);

	// Layer selector
	const selectorEl = document.createElement('div');
	selectorEl.style.overflow = 'auto';
	selectorEl.title = 'Ctrl+click : multicouches';
	button.element.appendChild(selectorEl);

	button.setMap = function(map) { //HACK execute actions on Map init
		ol.control.Control.prototype.setMap.call(this, map);

		// Base layers selector init
		for (let name in options.baseLayers)
			if (options.baseLayers[name]) { // array of layers, mandatory, no default
				const baseEl = document.createElement('div');
				baseEl.innerHTML =
					'<input type="checkbox" name="baselayer" value="' + name + '">' +
					'<span title="">' + name + '</span>';
				selectorEl.appendChild(baseEl);
				map.addLayer(options.baseLayers[name]);
			}

		// Make the selector memorized by cookies
		controlPermanentCheckbox('baselayer', displayLayerSelector);

		// Hover the button open the selector
		button.element.firstElementChild.onmouseover = displayLayerSelector;

		// Click or change map size close the selector
		map.on(['click', 'change:size'], function() {
			displayLayerSelector();
		});

		// Leaving the map close the selector
		window.addEventListener('mousemove', function(evt) {
			const divRect = map.getTargetElement().getBoundingClientRect();
			if (evt.clientX < divRect.left || evt.clientX > divRect.right ||
				evt.clientY < divRect.top || evt.clientY > divRect.bottom)
				displayLayerSelector();
		});
	};

	function displayLayerSelector(evt, list) {
		// Check the first if none checked
		if (list && list.length === 0)
			selectorEl.firstChild.firstChild.checked = true;

		// Leave only one checked except if Ctrl key is on
		if (evt && evt.type == 'click' && !evt.ctrlKey) {
			const checkEls = document.getElementsByName('baselayer');
			for (let e = 0; e < checkEls.length; e++)
				if (checkEls[e] != evt.target)
					checkEls[e].checked = false;
		}

		list = permanentCheckboxList('baselayer');

		// Refresh layers visibility & opacity
		for (let layerName in options.baseLayers)
			if (typeof options.baseLayers[layerName] == 'object') {
				options.baseLayers[layerName].setVisible(list.indexOf(layerName) !== -1);
				options.baseLayers[layerName].setOpacity(0);
			}
		if (typeof options.baseLayers[list[0]] == 'object')
			options.baseLayers[list[0]].setOpacity(1);
		if (list.length >= 2)
			options.baseLayers[list[1]].setOpacity(rangeEl.value / 100);

		// Refresh control button, range & selector
		button.element.firstElementChild.style.display = evt ? 'none' : '';
		rangeEl.style.display = evt && list.length > 1 ? '' : 'none';
		selectorEl.style.display = evt ? '' : 'none';
		selectorEl.style.maxHeight = (button.getMap().getTargetElement().clientHeight - 58 - (list.length > 1 ? 24 : 0)) + 'px';
	}
	return button;
}

/**
 * Permalink control
 * "map" url hash or cookie = {map=<ZOOM>/<LON>/<LAT>/<LAYER>}
 */
//TODO BEST save curent layer
function controlPermalink(o) {
	const options = Object.assign({
			hash: '?', // {?, #} the permalink delimiter
			visible: true, // {true | false} add a controlPermalink button to the map.
			init: true, // {true | false} use url hash or "controlPermalink" cookie to position the map.
		}, o),
		aEl = document.createElement('a'),
		control = new ol.control.Control({
			element: document.createElement('div'), //HACK No button
			render: render,
		});
	control.element.appendChild(aEl);

	let params = (location.hash + location.search).match(/map=([-.0-9]+)\/([-.0-9]+)\/([-.0-9]+)/) || // Priority to the hash
		document.cookie.match(/map=([-.0-9]+)\/([-.0-9]+)\/([-.0-9]+)/) || // Then the cookie
		(options.initialFit || '6/2/47').match(/([-.0-9]+)\/([-.0-9]+)\/([-.0-9]+)/); // Url arg format : <ZOOM>/<LON>/<LAT>/<LAYER>

	if (options.visible) {
		control.element.className = 'ol-permalink';
		aEl.innerHTML = 'Permalink';
		aEl.title = 'Generate a link with map zoom & position';
		control.element.appendChild(aEl);
	}

	if (typeof options.initialCenter == 'function') {
		options.initialCenter([parseFloat(params[2]), parseFloat(params[3])]);
	}

	function render(evt) {
		const view = evt.map.getView();

		// Set center & zoom at the init
		if (options.init &&
			params) { // Only once
			view.setZoom(params[1]);
			view.setCenter(ol.proj.transform([parseFloat(params[2]), parseFloat(params[3])], 'EPSG:4326', 'EPSG:3857'));
			params = null;
		}

		// Set the permalink with current map zoom & position
		if (view.getCenter()) {
			const ll4326 = ol.proj.transform(view.getCenter(), 'EPSG:3857', 'EPSG:4326'),
				newParams = [
					parseInt(view.getZoom()),
					Math.round(ll4326[0] * 100000) / 100000,
					Math.round(ll4326[1] * 100000) / 100000
				];

			aEl.href = options.hash + 'map=' + newParams.join('/');
			document.cookie = 'map=' + newParams.join('/') + ';path=/;SameSite=Strict';
		}
	}
	return control;
}

/**
 * Control to displays the length of a line overflown
 * option hoverStyle style the hovered feature
 * Requires controlButton
 */
function controlLengthLine() {
	const control = new ol.control.Control({
		element: document.createElement('div'), // div to display the measure
	});
	control.element.className = 'ol-length-line';

	control.setMap = function(map) { //HACK execute actions on Map init
		ol.control.Control.prototype.setMap.call(this, map);

		map.on('pointermove', function(evt) {
			control.element.innerHTML = ''; // Clear the measure if hover no feature

			// Find new features to hover
			map.forEachFeatureAtPixel(evt.pixel, calculateLength, {
				hitTolerance: 6,
			});
		});
	};

	//TODO BEST calculate distance to the ends
	function calculateLength(feature) {
		// Display the line length
		if (feature) {
			const length = ol.sphere.getLength(feature.getGeometry());
			if (length >= 100000)
				control.element.innerHTML = (Math.round(length / 1000)) + ' km';
			else if (length >= 10000)
				control.element.innerHTML = (Math.round(length / 100) / 10) + ' km';
			else if (length >= 1000)
				control.element.innerHTML = (Math.round(length / 10) / 100) + ' km';
			else if (length >= 1)
				control.element.innerHTML = (Math.round(length)) + ' m';
		}
		return false; // Continue detection (for editor that has temporary layers)
	}
	return control;
}

/**
 * Control to displays set preload of 4 upper level tiles if we are on full screen mode
 * This prepares the browser to become offline on the same session
 * Requires controlButton
 */
function controlTilesBuffer() {
	const control = new ol.control.Control({
		element: document.createElement('div'), //HACK No button
	});

	control.setMap = function(map) { //HACK execute actions on Map init
		ol.control.Control.prototype.setMap.call(this, map);

		map.on('change:size', function() { // Enable the function when the window expand to fullscreen
			const fs = document.webkitIsFullScreen || document.mozFullScreen || document.msFullscreenElement || document.fullscreenElement;
			map.getLayers().forEach(function(layer) {
				if (typeof layer.setPreload == 'function')
					layer.setPreload(fs ? 4 : 0);
			});
		});
	};
	return control;
}

/**
 * Geocoder
 * Requires https://github.com/jonataswalker/ol-geocoder/tree/master/dist
 */
function controlGeocoder() {
	// Vérify if geocoder is available (not supported in IE)
	const ua = navigator.userAgent;
	if (typeof Geocoder != 'function' ||
		ua.indexOf('MSIE ') > -1 || ua.indexOf('Trident/') > -1)
		return new ol.control.Control({
			element: document.createElement('div'), //HACK No button
		});

	const geocoder = new Geocoder('nominatim', {
		provider: 'osm',
		lang: 'FR',
		keepOpen: true,
		placeholder: 'Recherche sur la carte' // Initialization of the input field
	});
	geocoder.container.firstChild.firstChild.title = 'Recherche sur la carte';
	geocoder.container.style.top = '.5em';
	geocoder.container.style.left = (nextButtonPos += 2) + 'em';

	return geocoder;
}

/**
 * GPS control
 * Requires controlButton
 */
//TODO BEST force north button (gps 4th position)
//TODO GPS tap on map = distance from GPS calculation
function controlGPS(options) {
	// Vérify if geolocation is available
	if (!navigator.geolocation ||
		!window.location.href.match(/https|localhost/i))
		return new ol.control.Control({ // No button
			element: document.createElement('div'),
		});

	let gps = {}, // Mem last sensors values
		compas = {},
		graticule = new ol.Feature(),
		northGraticule = new ol.Feature(),
		graticuleLayer = new ol.layer.Vector({
			source: new ol.source.Vector({
				features: [graticule, northGraticule]
			}),
			style: new ol.style.Style({
				fill: new ol.style.Fill({
					color: 'rgba(128,128,255,0.2)'
				}),
				stroke: new ol.style.Stroke({
					color: '#20b',
					lineDash: [16, 14],
					width: 1
				})
			})
		}),

		// The control button
		button = controlButton({
			className: 'ol-gps',
			buttonBackgroundColors: ['white', '#ef3', '#ccc'],
			title: 'Centrer sur la position GPS',
			stateNumber: 3,
			activate: function(active) {
				const map = button.getMap();
				// Toggle reticule, position & rotation
				geolocation.setTracking(active);
				switch (active) {
					case 0: // Nothing
						map.removeLayer(graticuleLayer);
						break;
					case 1: // Track, reticule & center to the position / orientation
						map.addLayer(graticuleLayer);
						// case 2: Track & display reticule
				}
			}
		}),

		// Interface with the GPS system
		geolocation = new ol.Geolocation({
			trackingOptions: {
				enableHighAccuracy: true
			}
		});

	northGraticule.setStyle(new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: '#c00',
			lineDash: [16, 14],
			width: 1
		})
	}));

	geolocation.on('error', function(error) {
		alert('Geolocation error: ' + error.message);
	});

	geolocation.on('change', function() {
		gps.position = ol.proj.fromLonLat(geolocation.getPosition());
		gps.accuracyGeometry = geolocation.getAccuracyGeometry().transform('EPSG:4326', 'EPSG:3857');
		/* //TODO GPS Firefox Update delta only over some speed
		if (!navigator.userAgent.match('Firefox'))

		if (geolocation.getHeading()) {
			gps.heading = -geolocation.getHeading(); // Delivered radians, clockwize
			gps.delta = gps.heading - compas.heading; // Freeze delta at this time bewteen the GPS heading & the compas
		} */

		renderReticule();
	});

	button.setMap = function(map) { //HACK execute actions on Map init
		ol.control.Control.prototype.setMap.call(this, map);
		map.on('moveend', renderReticule); // Refresh graticule after map zoom
	};

	// Browser heading from the inertial sensors
	window.addEventListener(
		'ondeviceorientationabsolute' in window ?
		'deviceorientationabsolute' : // Gives always the magnetic north
		'deviceorientation', // Gives sometime the magnetic north, sometimes initial device orientation
		function(evt) {
			const heading = evt.alpha || evt.webkitCompassHeading; // Android || iOS
			if (heading)
				compas = {
					heading: Math.PI / 180 * (heading - screen.orientation.angle), // Delivered ° reverse clockwize
					absolute: evt.absolute // Gives initial device orientation | magnetic north
				};

			renderReticule();
		}
	);

	function renderReticule() {
		if (button.active && gps && gps.position) {
			// Estimate the viewport size
			const map = button.getMap(),
				view = map.getView(),
				hg = map.getCoordinateFromPixel([0, 0]),
				bd = map.getCoordinateFromPixel(map.getSize()),
				far = Math.hypot(hg[0] - bd[0], hg[1] - bd[1]) * 10;

			if (!graticule.getGeometry()) // Only once the first time the feature is enabled
				view.setZoom(17); // Zoom on the area

			if (button.active == 1)
				view.setCenter(gps.position);

			// Draw the graticule
			graticule.setGeometry(new ol.geom.GeometryCollection([
				gps.accuracyGeometry, // The accurate circle
				new ol.geom.MultiLineString([ // The graticule
					[add2(gps.position, [-far, 0]), add2(gps.position, [far, 0])],
					[gps.position, add2(gps.position, [0, -far])],
				]),
			]));
			northGraticule.setGeometry(new ol.geom.GeometryCollection([
				new ol.geom.LineString( // Color north in red
					[gps.position, add2(gps.position, [0, far])]
				),
			]));

			// Map orientation (Radians and reverse clockwize)
			//TODO GPS keep orientation when stop gps tracking
			if (compas.absolute && button.active == 1)
				view.setRotation(compas.heading, 0); // Use magnetic compas value
			/* //TODO GPS Firefox use delta if speed > ??? km/h
					compas.absolute ?
					compas.heading : // Use magnetic compas value
					compas.heading && gps.delta ? compas.heading + gps.delta : // Correct last GPS heading with handset moves
					0
				); */

			// Optional callback function
			if (options && typeof options.callBack == 'function') // Default undefined
				options.callBack(gps.position);
		}
	}

	function add2(a, b) {
		return [a[0] + b[0], a[1] + b[1]];
	}
	return button;
}

/**
 * GPX file loader control
 * Requires controlButton
 */
function controlLoadGPX(o) {
	const options = Object.assign({
			className: 'ol-load-gpx',
			title: 'Visualiser un fichier GPX sur la carte',
			activate: function() {
				inputEl.click();
			},
			style: new ol.style.Style({
				stroke: new ol.style.Stroke({
					color: 'blue',
					width: 3
				})
			}),
		}, o),
		inputEl = document.createElement('input'),
		format = new ol.format.GPX(),
		reader = new FileReader(),
		button = controlButton(options);

	inputEl.type = 'file';
	inputEl.addEventListener('change', function() {
		reader.readAsText(inputEl.files[0]);
	});

	reader.onload = function() {
		const map = button.getMap(),
			features = format.readFeatures(reader.result, {
				dataProjection: 'EPSG:4326',
				featureProjection: 'EPSG:3857'
			}),
			added = map.dispatchEvent({
				type: 'myol:onfeatureload', // Warn layerEdit that we uploaded some features
				features: features
			});

		if (added !== false) { // If one used the feature
			// Display the track on the map
			const source = new ol.source.Vector({
					format: format,
					features: features
				}),
				layer = new ol.layer.Vector({
					source: source,
					style: options.style
				});
			map.addLayer(layer);
			map.getView().fit(source.getExtent());
		}

		// Zoom the map on the added features
		const extent = ol.extent.createEmpty();
		for (let f in features)
			ol.extent.extend(extent, features[f].getGeometry().getExtent());
		map.getView().fit(extent, {
			maxZoom: 17,
		});
	};
	return button;
}

/**
 * GPX file downloader control
 * Requires controlButton
 */
//TODO BEST load WPT
function controlDownloadGPX(o) {
	const options = Object.assign({
			className: 'ol-download-gpx',
			title: 'Obtenir un fichier GPX contenant\nles éléments visibles dans la fenêtre.',
			fileName: document.title || 'openlayers',
			activate: activate,
		}, o),
		hiddenEl = document.createElement('a'),
		button = controlButton(options);
	hiddenEl.target = '_self';
	hiddenEl.download = options.fileName + '.gpx';
	hiddenEl.style = 'display:none';
	document.body.appendChild(hiddenEl);

	function activate() { // Callback at activation / desactivation, mandatory, no default
		let features = [],
			extent = button.getMap().getView().calculateExtent();

		// Get all visible features
		button.getMap().getLayers().forEach(function(layer) {
			if (layer.getSource() && layer.getSource().forEachFeatureInExtent) // For vector layers only
				layer.getSource().forEachFeatureInExtent(extent, function(feature) {
					features.push(feature);
				});
		});

		// Write in GPX format
		const gpx = new ol.format.GPX().writeFeatures(features, {
				dataProjection: 'EPSG:4326',
				featureProjection: 'EPSG:3857',
				decimals: 5
			})
			.replace(/<rte/g, '<trk')
			.replace(/<[a-z]*>\[object Object\]<\/[a-z]*>/g, '')
			.replace(/(<trk|<\/trk|<wpt|<\/wpt|<\/gpx)/g, '\n$1')
			.replace(/(<sym)/g, '\n\t$1'),
			file = new Blob([gpx], {
				type: 'application/gpx+xml'
			});

		if (typeof navigator.msSaveBlob == 'function') // IE/Edge
			navigator.msSaveBlob(file, options.fileName + '.gpx');
		else {
			hiddenEl.href = URL.createObjectURL(file);
			hiddenEl.click();
		}
	}
	return button;
}

/**
 * Print control
 * Requires controlButton
 */
//TODO BUG : don't mem checks when printing
function controlPrint() {
	const button = controlButton({
			className: 'ol-print',
			title: 'Imprimer la carte',
			activate: function() {
				resizeDraft(button.getMap());
				button.getMap().once('rendercomplete', function() {
					window.print();
					window.location.href = window.location.href;
				});
			},
		}),
		orientationEl = document.createElement('div');

	// Add orientation selectors below the button
	orientationEl.innerHTML = '<input type="radio" name="ori" value="0">Portrait A4<br>' +
		'<input type="radio" name="ori" value="1">Paysage A4';
	orientationEl.className = 'ol-control-hidden';

	button.element.appendChild(orientationEl);
	button.element.onmouseover = function() {
		orientationEl.className = 'ol-control-question';
	};
	button.element.onmouseout = function() {
		orientationEl.className = 'ol-control-hidden';
	};
	button.setMap = function(map) { //HACK execute actions on Map init
		ol.control.Control.prototype.setMap.call(this, map);

		const oris = document.getElementsByName('ori');
		for (let i = 0; i < oris.length; i++) // Use « for » because of a bug in Edge / IE
			oris[i].onchange = resizeDraft;
	};

	function resizeDraft() {
		// Resize map to the A4 dimensions
		const map = button.getMap(),
			mapEl = map.getTargetElement(),
			oris = document.querySelectorAll("input[name=ori]:checked"),
			ori = oris.length ? oris[0].value : 0;
		mapEl.style.width = ori == 0 ? '210mm' : '297mm';
		mapEl.style.height = ori == 0 ? '290mm' : '209.9mm'; // -.1mm for Chrome landscape no marging bug
		map.setSize([mapEl.offsetWidth, mapEl.offsetHeight]);

		// Hide other elements than the map
		while (document.body.firstChild)
			document.body.removeChild(document.body.firstChild);

		// Raises the map to the top level
		document.body.appendChild(mapEl);
		document.body.style.margin = 0;
		document.body.style.padding = 0;
	}
	return button;
}

/**
 * Line & Polygons Editor
 * Requires controlButton, escapedStyle, JSONparse, HACK map_
 */
function layerEdit(o) {
	const options = Object.assign({
			geoJsonId: 'editable-json', // Option geoJsonId : html element id of the geoJson features to be edited
		}, o),
		format = new ol.format.GeoJSON(),
		geoJsonEl = document.getElementById(options.geoJsonId), // Read data in an html element
		features = format.readFeatures(
			JSONparse(geoJsonEl.value || '{"type":"FeatureCollection","features":[]}'), {
				featureProjection: 'EPSG:3857', // Read/write data as ESPG:4326 by default
			}
		),
		source = new ol.source.Vector({
			features: features,
			wrapX: false,
		}),
		layer = new ol.layer.Vector({
			source: source,
			zIndex: 20,
			style: escapedStyle(options.styleOptions),
		}),
		snap = new ol.interaction.Snap({
			source: source,
		}),
		hover = new ol.interaction.Select({
			condition: ol.events.condition.pointerMove,
			hitTolerance: 6,
			filter: function(feature, l) {
				return l == layer;
			},
			style: escapedStyle(options.styleOptions, options.editStyleOptions),
		});

	source.save = function() {
		// Save lines in <EL> as geoJSON at every change
		geoJsonEl.value = format.writeFeatures(features, {
			featureProjection: 'EPSG:3857',
			decimals: 5,
		});
	};

	layer.createRenderer = function() { //HACK to get control at the layer init
		const map = layer.map_;

		//HACK Avoid zooming when you leave the mode by doubleclick
		map.getInteractions().forEach(function(i) {
			if (i instanceof ol.interaction.DoubleClickZoom)
				map.removeInteraction(i);
		});

		map.addInteraction(hover);
		options.controls.forEach(function(c) { // Option controls : [controlModify, controlDrawLine, controlDrawPolygon]
			const control = c(Object.assign({
				group: layer,
				layer: layer,
				buttonBackgroundColors: ['white', '#ef3'],
				source: source,
				style: escapedStyle(options.styleOptions, options.editStyleOptions),
				activate: function(active) {
					control.interaction.setActive(active);
					if (active)
						map.removeInteraction(hover);
					else
						map.addInteraction(hover);
				},
			}, options));
			control.interaction.setActive(false);
			map.addInteraction(control.interaction);
			map.addControl(control);
		});

		// Snap on features internal to the editor
		map.addInteraction(snap);
		// Snap on features external to the editor
		if (options.snapLayers) // Optional option snapLayers : [list of layers to snap]
			options.snapLayers.forEach(function(l) {
				l.getSource().on('change', function() {
					const fs = l.getSource().getFeatures();
					for (let f in fs)
						snap.addFeature(fs[f]);
				});
			});

		// End of feature creation
		source.on('change', function() { // Called all sliding long
			if (source.modified) { // Awaiting adding complete to save it
				source.modified = false; // To avoid loops
				optimiseEdited(source);
			}
		});

		// Add features loaded from GPX file
		map.on('myol:onfeatureload', function(evt) {
			source.addFeatures(evt.features);
			optimiseEdited(source);
			return false; // Warn controlLoadGPX that the editor got the included feature
		});

		return ol.layer.Vector.prototype.createRenderer.call(this);
	};
	return layer;
}

//TODO EDIT hover feature when modifing
function controlModify(options) {
	const button = controlButton(Object.assign({
		className: 'ol-modify',
		title: 'Modification d‘une ligne, d‘un polygone:\n' +
			'Activer "M" (couleur jaune) puis\n' +
			'Cliquer et déplacer un sommet pour modifier une ligne ou un polygone\n' +
			'Cliquer sur un segment puis déplacer pour créer un sommet\n' +
			'Alt+cliquer sur un sommet pour le supprimer\n' +
			'Alt+cliquer sur un segment à supprimer dans une ligne pour la couper\n' +
			'Alt+cliquer sur un segment à supprimer d‘un polygone pour le transformer en ligne\n' +
			'Joindre les extrémités deux lignes pour les fusionner\n' +
			'Joindre les extrémités d‘une ligne pour la transformer en polygone\n' +
			'Ctrl+Alt+cliquer sur un côté d‘une ligne ou d‘un polygone pour les supprimer',
	}, options));

	button.interaction = new ol.interaction.Modify(options);
	button.interaction.on('modifyend', function(evt) {
		if (evt.mapBrowserEvent.originalEvent.altKey) {
			// altKey + ctrlKey : delete feature
			//TODO EDIT delete only a summit when Ctrl+Alt click
			if (evt.mapBrowserEvent.originalEvent.ctrlKey) {
				const selectedFeatures = button.getMap().getFeaturesAtPixel(evt.mapBrowserEvent.pixel, {
					hitTolerance: 6,
					layerFilter: function(l) {
						return l.ol_uid == options.layer.ol_uid;
					}
				});
				for (let f in selectedFeatures)
					options.source.removeFeature(selectedFeatures[f]); // We delete the selected feature
			}
			// Other modify actions : altKey + click on a segment = delete the segment
			else if (evt.target.vertexFeature_)
				return optimiseEdited(options.source, evt.target.vertexFeature_.getGeometry().getCoordinates());
		}
		optimiseEdited(options.source);
	});
	return button;
}

function controlDrawLine(options) {
	const button = controlButton(Object.assign({
		className: 'ol-draw-line',
		title: 'Création d‘une ligne:\n' +
			'Activer "L" puis\n' +
			'Cliquer sur la carte et sur chaque point désiré pour dessiner une ligne,\n' +
			'double cliquer pour terminer.\n' +
			'Cliquer sur une extrémité d‘une ligne pour l‘étendre',
	}, options));

	button.interaction = new ol.interaction.Draw(Object.assign({
		type: 'LineString',
	}, options));
	button.interaction.on(['drawend'], function() {
		button.toggle(0);
		// Warn source 'on change' to save the feature
		// Don't do it now as it's not yet added to the source
		options.source.modified = true;
	});
	return button;
}

function controlDrawPolygon(options) {
	return controlDrawLine(Object.assign({
		className: 'ol-draw-polygon',
		type: 'Polygon',
		title: 'Modification d‘un polygone:\n' +
			'Activer "P" puis\n' +
			'Cliquer sur la carte et sur chaque point désiré pour dessiner un polygone,\n' +
			'double cliquer pour terminer.\n' +
			'Si le nouveau polygone est entièrement compris dans un autre, il crée un "trou".',
	}, options));
}

// Reorganise Points, Lines & Polygons
function optimiseEdited(source, pointerPosition) {
	// Get all edited features
	let lines = getLines(source.getFeatures(), pointerPosition),
		polys = [];
	source.clear(); // Remove everything

	// Get flattened list of multipoints coords
	for (let a = 0; a < lines.length; a++) {
		// Exclude 1 coord features (points)
		if (lines[a] && lines[a].length < 2)
			lines[a] = null;

		// Convert closed lines into polygons
		if (compareCoords(lines[a])) {
			polys.push([lines[a]]);
			lines[a] = null;
		}
		// Merge lines having a common end
		for (let b = 0; b < a; b++) { // Once each combination
			const m = [a, b];
			for (let i = 4; i; i--) // 4 times
				if (lines[m[0]] && lines[m[1]]) {
					// Shake lines end to explore all possibilities
					m.reverse();
					lines[m[0]].reverse();
					if (compareCoords(lines[m[0]][lines[m[0]].length - 1], lines[m[1]][0])) {

						// Merge 2 lines matching ends
						lines[m[0]] = lines[m[0]].concat(lines[m[1]]);
						lines[m[1]] = 0;

						// Restart all the loops
						a = -1;
						break;
					}
				}
		}
	}
	// Makes holes if a polygon is included in a biggest one
	for (let p1 in polys)
		if (polys[p1]) {
			const fs = new ol.geom.Polygon(polys[p1]);
			for (let p2 in polys)
				if (p1 != p2 &&
					polys[p2]) {
					let intersects = true;
					for (let c in polys[p2][0])
						if (!fs.intersectsCoordinate(polys[p2][0][c]))
							intersects = false;
					if (intersects) {
						polys[p1].push(polys[p2][0]);
						polys[p2] = null;
					}
				}
		}
	//TODO EDIT option not to be able to cut a polygon (WRI / alpages)

	// Recreate modified features
	for (let l in lines)
		if (lines[l]) {
			source.addFeature(new ol.Feature({
				geometry: new ol.geom.LineString(lines[l])
			}));
		}
	for (let p in polys)
		if (polys[p])
			source.addFeature(new ol.Feature({
				geometry: new ol.geom.Polygon(polys[p])
			}));
	source.save();
}

function getLines(features, pointerPosition) {
	let lines = [];
	for (let f in features)
		if (typeof features[f].getGeometry().getGeometries == 'function') { // GeometryCollection
			const geometries = features[f].getGeometry().getGeometries();
			for (let g in geometries)
				flatCoord(lines, geometries[g].getCoordinates(), pointerPosition);
		} else if (!features[f].getGeometry().getType().match(/point$/i)) // Not a point
		flatCoord(lines, features[f].getGeometry().getCoordinates(), pointerPosition); // Lines or polyons

	return lines;
}

// Get all lines fragments at the same level & split aif one point = pointerPosition
function flatCoord(existingCoords, newCoords, pointerPosition) {
	if (typeof newCoords[0][0] == 'object')
		for (let c1 in newCoords)
			flatCoord(existingCoords, newCoords[c1], pointerPosition);
	else {
		existingCoords.push([]); // Increment existingCoords array
		for (let c2 in newCoords)
			if (pointerPosition && compareCoords(newCoords[c2], pointerPosition)) {
				existingCoords.push([]); // & increment existingCoords array
			} else
				// Stack on the last existingCoords array
				existingCoords[existingCoords.length - 1].push(newCoords[c2]);
	}
}

function compareCoords(a, b) {
	if (!a)
		return false;
	if (!b)
		return compareCoords(a[0], a[a.length - 1]); // Compare start with end
	return a[0] == b[0] && a[1] == b[1]; // 2 coords
}


/**
 * Tile layers examples
 */
function layersCollection(keys) {
	return {
		'OpenTopo': layerOSM(
			'//{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
			'<a href="https://opentopomap.org">OpenTopoMap</a> ' +
			'(<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
			17
		),
		'OSM outdoors': layerThunderforest(keys.thunderforest, 'outdoors'),
		'OSM-FR': layerOSM('//{a-c}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png'),
		'OSM': layerOSM('//{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
		'MRI': layerOSM(
			'//maps.refuges.info/hiking/{z}/{x}/{y}.png',
			'<a href="http://wiki.openstreetmap.org/wiki/Hiking/mri">MRI</a>'
		),
		'Hike & Bike': layerOSM(
			'http://{a-c}.tiles.wmflabs.org/hikebike/{z}/{x}/{y}.png',
			'<a href="http://www.hikebikemap.org/">hikebikemap.org</a>'
		), // Not on https
		'Autriche': layerKompass('KOMPASS Touristik'),
		'Kompas': layerKompass('KOMPASS'),
		'OSM cycle': layerThunderforest(keys.thunderforest, 'cycle'),
		'OSM landscape': layerThunderforest(keys.thunderforest, 'landscape'),
		'OSM transport': layerThunderforest(keys.thunderforest, 'transport'),
		'OSM trains': layerThunderforest(keys.thunderforest, 'pioneer'),
		'OSM villes': layerThunderforest(keys.thunderforest, 'neighbourhood'),
		'OSM contraste': layerThunderforest(keys.thunderforest, 'mobile-atlas'),

		'IGN': layerIGN(keys.ign, 'GEOGRAPHICALGRIDSYSTEMS.MAPS'),
		'IGN TOP 25': layerIGN(keys.ign, 'GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-EXPRESS.STANDARD'),
		'IGN classique': layerIGN(keys.ign, 'GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-EXPRESS.CLASSIQUE'),
		'IGN photos': layerIGN(keys.ign, 'ORTHOIMAGERY.ORTHOPHOTOS'),
		//403	'IGN Spot': layerIGN(keys.ign, 'ORTHOIMAGERY.ORTHO-SAT.SPOT.2017', 'png'),
		//Double		'SCAN25TOUR': layerIGN(keys.ign, 'GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN25TOUR'),
		'IGN 1950': layerIGN(keys.ign, 'ORTHOIMAGERY.ORTHOPHOTOS.1950-1965', 'png'),
		'Cadastre': layerIGN(keys.ign, 'CADASTRALPARCELS.PARCELS', 'png'),
		//Le style normal n'est pas geré	'Cadast.Exp': layerIGN(keys.ign, 'CADASTRALPARCELS.PARCELLAIRE_EXPRESS', 'png'),
		'Etat major': layerIGN(keys.ign, 'GEOGRAPHICALGRIDSYSTEMS.ETATMAJOR40'),
		'ETATMAJOR10': layerIGN(keys.ign, 'GEOGRAPHICALGRIDSYSTEMS.ETATMAJOR10'),
		'IGN plan': layerIGN(keys.ign, 'GEOGRAPHICALGRIDSYSTEMS.PLANIGN'),
		'IGN route': layerIGN(keys.ign, 'GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-EXPRESS.ROUTIER'),
		'IGN noms': layerIGN(keys.ign, 'GEOGRAPHICALNAMES.NAMES', 'png'),
		'IGN rail': layerIGN(keys.ign, 'TRANSPORTNETWORKS.RAILWAYS', 'png'),
		'IGN hydro': layerIGN(keys.ign, 'HYDROGRAPHY.HYDROGRAPHY', 'png'),
		'IGN forêt': layerIGN(keys.ign, 'LANDCOVER.FORESTAREAS', 'png'),
		'IGN limites': layerIGN(keys.ign, 'ADMINISTRATIVEUNITS.BOUNDARIES', 'png'),
		//Le style normal n'est pas geré	'SHADOW': layerIGN(keys.ign, 'ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW', 'png'),
		//Le style normal n'est pas geré	'PN': layerIGN(keys.ign, 'PROTECTEDAREAS.PN', 'png'),
		'PNR': layerIGN(keys.ign, 'PROTECTEDAREAS.PNR', 'png'),
		//403	'Avalanches':	layerIGN('IGN avalanches', keys.ign,'GEOGRAPHICALGRIDSYSTEMS.SLOPES.MOUNTAIN'),

		'Swiss': layerSwissTopo('ch.swisstopo.pixelkarte-farbe'),
		'Swiss photo': layerSwissTopo('ch.swisstopo.swissimage', layerGoogle('s')),
		'Espagne': layerSpain('mapa-raster', 'MTN'),
		'Espagne photo': layerSpain('pnoa-ma', 'OI.OrthoimageCoverage'),
		'Italie': layerIGM(),
		'Angleterre': layerOS(keys.bing),
		//BUG		'Bing': layerBing(keys.bing, 'Road'),
		'Bing photo': layerBing(keys.bing, 'AerialWithLabels'),
		'Google road': layerGoogle('m'),
		'Google terrain': layerGoogle('p'),
		'Google photo': layerGoogle('s'),
		'Google hybrid': layerGoogle('s,h'),
		'Stamen': layerStamen('terrain'),
		'Toner': layerStamen('toner'),
		'Watercolor': layerStamen('watercolor'),
	};
}

/**
 * Controls examples
 */
function controlsCollection(options) {
	options = options || {};
	if (!options.baseLayers)
		options.baseLayers = layersCollection(options.geoKeys);

	return [
		controlLayersSwitcher(Object.assign({
			baseLayers: options.baseLayers,
			geoKeys: options.geoKeys
		}, options.controlLayersSwitcher)),
		controlTilesBuffer(),
		controlPermalink(options.controlPermalink),
		new ol.control.Attribution({
			collapsible: false // Attribution always open
		}),
		new ol.control.ScaleLine(),
		new ol.control.MousePosition({
			coordinateFormat: ol.coordinate.createStringXY(5),
			projection: 'EPSG:4326',
			className: 'ol-coordinate',
			undefinedHTML: String.fromCharCode(0)
		}),
		controlLengthLine(),
		new ol.control.Zoom({
			zoomOutLabel: '-'
		}),
		new ol.control.FullScreen({
			label: '', //HACK Bad presentation on IE & FF
			tipLabel: 'Plein écran'
		}),
		controlGeocoder(),
		controlGPS(options.controlGPS),
		controlLoadGPX(),
		controlDownloadGPX(options.controlDownloadGPX),
		controlPrint(),
	];
}