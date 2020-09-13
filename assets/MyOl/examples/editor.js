const editor = layerGeoJson({
		geoJsonId: 'geojson',
		snapLayers: [wri],
		titleModify: 'Modification d‘une ligne, d‘un polygone:\n' +
			'Activer ce bouton (couleur jaune) puis\n' +
			'Cliquer et déplacer un sommet pour modifier une ligne ou un polygone\n' +
			'Cliquer sur un segment puis déplacer pour créer un sommet\n' +
			'Alt+cliquer sur un sommet pour le supprimer\n' +
			'Alt+cliquer sur un segment à supprimer dans une ligne pour la couper\n' +
			'Alt+cliquer sur un segment à supprimer d‘un polygone pour le transformer en ligne\n' +
			'Joindre les extrémités deux lignes pour les fusionner\n' +
			'Joindre les extrémités d‘une ligne pour la transformer en polygone\n' +
			'Ctrl+Alt+cliquer sur une ligne ou un polygone pour les supprimer',
		titleLine: 'Création d‘une ligne:\n' +
			'Activer ce bouton (couleur jaune) puis\n' +
			'Cliquer sur la carte et sur chaque point désiré pour dessiner une ligne,\n' +
			'double cliquer pour terminer.\n' +
			'Cliquer sur une extrémité d‘une ligne pour l‘étendre',
		titlePolygon: 'Création d‘un polygone:\n' +
			'Activer ce bouton (couleur jaune) puis\n' +
			'Cliquer sur la carte et sur chaque point désiré pour dessiner un polygone,\n' +
			'double cliquer pour terminer.\n' +
			'Si le nouveau polygone est entièrement compris dans un autre, il crée un "trou".',
	});

new ol.Map({
	target: 'map',
	layers: [
		layerRefugesInfo(),
		editor,
	],
	controls: controlsCollection({
		geoKeys: {
			// Get your own (free) IGN key at http://professionnels.ign.fr/ign/contrats
			ign: 'hcxdz5f1p9emo4i1lch6ennl',
			// Get your own (free) THUNDERFOREST key at https://manage.thunderforest.com
			thunderforest: 'ee751f43b3af4614b01d1bce72785369',
			// Get your own (free) BING key at https://www.microsoft.com/en-us/maps/create-a-bing-maps-key
			bing: 'ArLngay7TxiroomF7HLEXCS7kTWexf1_1s1qiF7nbTYs2IkD3XLcUnvSlKbGRZxt'
			// SwissTopo : You need to register your domain in
			// https://shop.swisstopo.admin.ch/fr/products/geoservice/swisstopo_geoservices/WMTS_info
		},
	}),
});