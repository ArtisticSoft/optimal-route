'use strict';
//=============================================================================
/*
my LeafLet extensions
*/
//-----------------------------------------------------------------------------
/*
troubles
TypeError: t.icon.createIcon is not a function
solution: icon should be an instance created with 'new', not


how the icon images should be located - in the same catalog
page
https://leafletjs.com/examples/custom-icons/example-one-icon.html
image
https://leafletjs.com/examples/custom-icons/leaf-shadow.png
*/

//copy-paste from example
var myMapIconClass = L.Icon.extend({
	options: {
    imagePath: './assets/common/leaflet-my/images/',
    
//		iconUrl:       'marker-icon.png',
//		iconRetinaUrl: 'marker-icon-2x.png',
		shadowUrl:     'marker-shadow.png',
		iconSize:    [25, 41],
		iconAnchor:  [12, 41],
		popupAnchor: [1, -34],
		tooltipAnchor: [16, -28],
		shadowSize:  [41, 41]
	},

	_getIconUrl: function (name) {
		return (this.options.imagePath) + L.Icon.prototype._getIconUrl.call(this, name);
	}
});

//static props
myMapIconClass.file_name_ext = '.png';
myMapIconClass.file_name_base = 'marker-icon-';
myMapIconClass.file_name_base_retina = 'marker-icon-2x-';

/*
//copy-paste from example
var myMapIconClass = L.Icon.extend({
	options: {
    iconUrl: 'leaf-green.png',
		shadowUrl: 'leaf-shadow.png',
		iconSize:     [38, 95],
		shadowSize:   [50, 64],
		iconAnchor:   [22, 94],
		shadowAnchor: [4, 62],
		popupAnchor:  [-3, -76]
	}
});
*/

/*
inherit from IconDefault - FAILED

//L.IconDefault is undefined
//var myMapIconClass = L.IconDefault.extend({

//IconDefault is not defined
var myMapIconClass = IconDefault.extend({
});
*/

//var myTestIcon = new myMapIconClass();

//var greenIcon = new myMapIconClass({iconUrl: 'leaf-green.png'});
//var redIcon = new myMapIconClass({iconUrl: 'leaf-red.png'});
//var orangeIcon = new myMapIconClass({iconUrl: 'leaf-orange.png'});
//-----------------------------------------------------------------------------
/*using tooltip and permanent

howTo bind to a marker:
 * marker.bindTooltip("my tooltip text").openTooltip();

var Tooltip = DivOverlay.extend({

	// @section
	// @aka Tooltip options
	options: {
		// @option permanent: Boolean = false
		// Whether to open the tooltip permanently or only on mouseover.
		permanent: false,

Layer.include({

	// @method bindTooltip(content: String|HTMLElement|Function|Tooltip, options?: Tooltip options): this
	// Binds a tooltip to the layer with the passed `content` and sets up the
	// necessary event listeners. If a `Function` is passed it will receive
	// the layer as the first argument and should return a `String` or `HTMLElement`.
	bindTooltip: function (content, options) {

*/

//=============================================================================
