'use strict';
//=============================================================================
/*
карта и список маркеров
*/
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function MapWithMarkerListClass(options) {
  //this.C = this.constructor;
  this.C = MapWithMarkerListClass;//less elegant alternative in case pre-ES6 browsers don't support constructor
  this.SuperClass.static_properties_init.call(this);//can be called only in a special way
  
  this.back_end = options.back_end;
  
  //ключевой объект на странице. карта
  this.map_obj;
  this.MapCreate(options.map.id);
  this.marker_add_zoom_default = options.map.marker_add_zoom_default;
  
  //иконки маркерами с нарисованным номером 0..99
  this.IconsPoolCreate();

  //---ключевой объект на странице. список адресов
  this.address_list_html = document.getElementById(options.address_list_id);
  myUtils.Element_Clear(this.address_list_html);
  //homebrewed DnD 
  this.DragAndDrop = {
    saved: {
      focus: null,
      parent: null,
      style: null,
    },
    dragged_node: null,
    initial_offset: {x: 0, y: 0},
    placeholder: null,
    droppable_moved_over: null //используется для определения входа\выхода мыши из droppable
  };
  this.address_list_html.addEventListener('mousedown', this.draggable_onMouseDown.bind(this));
  this.address_list_html.addEventListener('mousemove', this.droppable_onMouseMove.bind(this));
  //DnD native. draggable. prevent it
  this.address_list_html.addEventListener('dragstart', this.draggable_onDragstart.bind(this));
  //this.address_list_html.addEventListener('dragend', this.draggable_onDragend.bind(this));
  //prevent some default behaviors
  this.address_list_html.addEventListener('click', this.draggable_onClick.bind(this));
  this.address_list_html.addEventListener('dblclick', this.draggable_onDblClick.bind(this));
  
  //the following handlers must be assigned to the whole page
  document.addEventListener('mousemove', this.document_onMouseMove.bind(this));
  document.addEventListener('mouseup', this.document_onMouseUp.bind(this));
 
  //---ключевой объект на странице. кнопка Оптимизировать маршрут
  this.route_optimize_btn = document.getElementById(options.route_optimize_btn_id);
  this.route_optimize_btn.addEventListener('click', this.route_optimize_btn_onClick.bind(this));
  //some browsers remember the Enabled state for buttons so make sure it is Disabled
  this.address_list_changed();
  
  /*
  ключевой массив 
  внутреннее представление адресов из списка
  отсюда данные будут отображаться на карте как маркеры и в списке адресов как "Label. Title"
  */
  this.address_list = {};
  //Index для эл-тов списка адресов. после добавления э-та в список будет увеличиваться
  //в будущем возможно отображение этого инекса на символы например A B C
  //может изменяться произвольно после оптимизации маршрута
  this.address_label_idx_to_assign = 1;
}

MapWithMarkerListClass.prototype = new GenericBaseClass();//inherit from
MapWithMarkerListClass.prototype.SuperClass = GenericBaseClass.prototype;

//авто-увеличивающийся ID для эл-тов списка адресов
//начальное значение большое чтобы не спутать с порядковым номером эл-та в списке
MapWithMarkerListClass.address_id_to_assign = 1000;

//-----------------------------------------------------------------------------
//Оптимизировать маршрут
//-----------------------------------------------------------------------------

MapWithMarkerListClass.prototype.route_optimize_btn_onClick = function (e) {
  this.log('route_optimize_btn_onClick. starting BackEnd.DistributionAddress...');
  
  var addresses = this.address_list_concatenate('id');
  
  //защита от повторных кликов кнпоки Оптимизировать
  if (this.addresses_last_optimized != addresses) {
    this.log('addresses ['+addresses+']');
    this.back_end.XHR_Start(
      this.back_end.DistributionAddress, 
      {address: addresses}, 
      this.OptimizeRouteFulfilled.bind(this)
    )
    
    this.addresses_last_optimized = addresses;
  }
};

/*
json sample 
{
  "address": {
    "1": "93c6c7590475e6ad865f3bd63e823319",
    "2": "de995f447bae6478753b7cd7133fffe7",
    "3": "d7436ab02856289762f4e029062f3ba7"
  },
  "md_list": "efbdfdeb023668bab6c044601346b395",
  "result": 1
}
*/
MapWithMarkerListClass.prototype.OptimizeRouteFulfilled = function (json) {
  this.log('OptimizeRouteFulfilled');
  this.log(json);

  this.address_list_reorder(json.address);
  
  //debug version - revert the list
  /*
  var addr_id_list = [];
  var children = this.address_list_html.childNodes;
  var child;
  for (var i = 0; i < children.length; i++) {
    addr_id_list.push(children[i].id);
  }
  addr_id_list.reverse();
  this.address_list_reorder(addr_id_list);
  */
};

MapWithMarkerListClass.prototype.address_list_reorder = function (addr_id_list) {
  this.log('address_list_reorder');
  
  var children = this.address_list_html.childNodes;
  var child;
  var child_wanted;
  
  var keys = Object.keys(addr_id_list);
  var id;
  for (var i = 0; i < keys.length; i++) {
    id = addr_id_list[keys[i]];
    child = children[i];
    if (child && child.id != id) {
      child_wanted = document.getElementById(id);//this may differ in the future
      if (child_wanted) {
        //переместить child с id из addr_id_list по текущему индексу
        child.parentNode.insertBefore(child_wanted, child);
      }
    }
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//объединить все адреса из списка в строку
MapWithMarkerListClass.prototype.address_list_concatenate = function (property) {
  var concatenated = '';
  var children = this.address_list_html.childNodes;
  var child;
  var v;
  
  for (var i = 0; i < children.length; i++) {
    if (concatenated.length) {
      concatenated += ',';
    }
    child = children[i];
    //this.log('child.innerHTML['+child.innerHTML+']');
    //this.log('child.id['+child.id+']');
    if (property == 'id') {
      v = child.id;
    } else {
      v = this.address_list[child.id][property];
    }
    concatenated += v;
  }
  return concatenated;
};

//список изменился - эл-т добавлен или удалён. обновить состояние кнопки Оптимизировать
MapWithMarkerListClass.prototype.address_list_changed = function (e) {
  var disabled = !this.address_list_html.hasChildNodes();
  //some browsers remember the Enabled state for buttons so make sure it is Disabled
  myUtils.Element_setAttributeBoolean(this.route_optimize_btn, 'disabled', disabled);
};

//-----------------------------------------------------------------------------
//Address list
//-----------------------------------------------------------------------------
/*
добавить маркер по адресу. запуск метода BackEnd.geocode
*/

MapWithMarkerListClass.prototype.MarkerAddFromAddress = function (address) {
  this.log('MarkerAddFromAddress. starting BackEnd.geocode...');
  this.log('address ['+address+']');
  
  //защита от повторных кликов кнпоки Добавить
  if (this.address_last_added != address) {
    this.back_end.XHR_Start(
      this.back_end.AddressGeocode, 
      {address: address}, 
      this.MarkerAddFromGeocode.bind(this, address)
    )
    
    this.address_last_added = address;
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
/*
добавить маркер из структуры данных возвращённой из BackEnd
*/

MapWithMarkerListClass.prototype.MarkerAddFromGeocode = function (address, json) {
  this.log('MarkerAddFromGeocode');
  //this.log('address ['+address+'] json.address_md['+json.address_md+']');
  this.MarkerAddFromLatLng(json.lat, json.lng, address, json.address_md);
}

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
/*
label - метка идентифицирующая маркер в UI например 1 2 3 или A B C
title - адрес или часть адреса, будет отображаться в PopUp
*/

MapWithMarkerListClass.prototype.MarkerAddFromLatLng = function (lat, lng, title, id) {
  //this.log('MarkerAddFromLatLng lat lng['+lat+']['+lng+'] title['+title+']');
  
  id = id || 'address-list-item-' + this.C.address_id_to_assign;
  
  var addr = {
    lat: lat,
    lng: lng,
    label: this.address_label_idx_to_assign, 
    title: title
  };
  
  this.address_list[id] = addr;
  
  this.C.address_id_to_assign += 1;
  this.address_label_idx_to_assign += 1; 

  //this.log('id=['+id+']');
  //this.log(addr);
  
  this.MarkerAddToMap(addr);
  this.MarkerAddToHtml(addr, id);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
/*
добавить маркер в список на странице
marker - внутреннее представление маркера = элемент this.address_list
*/
MapWithMarkerListClass.prototype.MarkerAddToHtml = function (marker, id) {
  var li = document.createElement('li');
  li.id = id;
  li.setAttribute('js_draggable', '');
  li.innerHTML = marker.label + '. ' + marker.title;

  this.address_list_html.appendChild(li);
  
  this.address_list_changed();
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//homebrewed DnD 
/*
---MouseEvent 
MouseEvent.button Read only
    The button number that was pressed (if applicable) when the mouse event was fired.
MouseEvent.buttons Read only
    The buttons being depressed (if any) when the mouse event was fired.
    
0: Main button pressed, usually the left button or the un-initialized state
1: Auxiliary button pressed, usually the wheel button or the middle button (if present)
2: Secondary button pressed, usually the right button

MouseEvent.clientX Read only
    The X coordinate of the mouse pointer in local (DOM content) coordinates.
MouseEvent.clientY Read only
    The Y coordinate of the mouse pointer in local (DOM content) coordinates.
    
MouseEvent.movementX Read only
    The X coordinate of the mouse pointer relative to the position of the last mousemove event.
MouseEvent.movementY Read only
    The Y coordinate of the mouse pointer relative to the position of the last mousemove event.
*/

MapWithMarkerListClass.prototype.draggable_onMouseDown = function (e) {
  this.log('draggable_onMouseDown');
  
  if (e.button == myUtilsClass.mouse.button.main) {
    if (e.target.hasAttribute('js_draggable')) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();//not sure this is neceassary
      
      //lose focus, if any. focus IS interfer with DnD
      this.DragAndDrop.saved.focus = myUtils.Document_Blur();
      
      //get a ref to the Dragged
      var dragged = this.DragAndDrop.dragged_node = e.target;
      var parent = this.DragAndDrop.saved.parent = dragged.parentNode;
      //save the current inline style props, if any
      var saved_style = this.DragAndDrop.saved.style = {};
      saved_style.position = dragged.style.position;
      saved_style.left = dragged.style.left;
      saved_style.top = dragged.style.top;
      saved_style.width = dragged.style.width;
      saved_style.height = dragged.style.height;
      
      //read the curent Dragged style. this is useful to 
      //  copy styles to a placeholder
      //  to set fixed WH so WH will not be affected by a new parent
      var dragged_style = window.getComputedStyle(dragged);
      dragged.style.width = dragged_style.width;
      dragged.style.height = dragged_style.height;

      //latch the initial offset between mouse and TL corner. this helps avoid Dragged to "jump" on the start-drag
      this.DragAndDrop.initial_offset = myUtils.xy_subtract(
        {x: dragged.getBoundingClientRect().left, y: dragged.getBoundingClientRect().top},
        {x: event.clientX, y: event.clientY}
      );
      
      //create a placeholder
      var placeholder = this.DragAndDrop.placeholder = document.createElement('li');
      placeholder.classList.add('placeholder');
      placeholder.style.height = dragged_style.height;
      
      //replace Dragged with Placeholder and attach Dragged to the whole Document
      var new_parent = document.body;
      //var new_parent = document.getElementById('dnd-parent');
      parent.replaceChild(placeholder, dragged);
      new_parent.appendChild(dragged);

      //set some inline styles
      dragged.style.position = 'absolute';
      this.Dragged_setPos(dragged, e);

      dragged.classList.add('dragged');
    }
  }
};

MapWithMarkerListClass.prototype.document_onMouseMove = function (e) {
  //this.log('document_onMouseMove');
  
  //! important to check isTrusted. this prevents infinite recursion 
  //because synthetic 'mousemove' event is created in this handler
  if (this.DragAndDrop.dragged_node && e.isTrusted) {
    e.preventDefault();
      
    var dragged = this.DragAndDrop.dragged_node;
    this.Dragged_setPos(dragged, e);
    
    //---synthetic event for the element below the Mouse = potential drop target
    dragged.hidden = true;//without this elementFromPoint will always return Draggable

    //DAMNED e.clientX\Y = undefined in FireFox. let's fallback
    var x = e.clientX || e.x;
    var y = e.clientY || e.y;

    var below = document.elementFromPoint(x, y);
    if (below) {
      //this event can be easy dintinguished from native events by .isTrusted = undefined = false
      var mouseEventInit = {
        bubbles: true,
        screenX:  e.screenX,
        screenY:  e.screenY, 
        clientX:  e.clientX || e.x, 
        clientY:  e.clientY || e.y, 
        ctrlKey:  e.ctrlKey, 
        shiftKey: e.shiftKey,
        altKey:   e.altKey,
        metaKey:  e.metaKey,
        button:   e.button, 
        buttons:  e.buttons
      };
      
      //this way not works :(
      //var mouseEventInit = {};
      //myUtils.Object_AppendFrom(mouseEventInit, e);
      //mouseEventInit.clientX = mouseEventInit.clientX || e.x;
      //mouseEventInit.clientY = mouseEventInit.clientY || e.y; 
      //mouseEventInit.bubbles = true;
      
      //this.log('mouseEventInit');
      //this.log(mouseEventInit);
      
      var synth_event = new MouseEvent('mousemove', mouseEventInit);
      below.dispatchEvent(synth_event);
    }
    dragged.hidden = false;
  }
};

MapWithMarkerListClass.prototype.document_onMouseUp = function (e) {
  this.log('document_onMouseUp');
  
  if (this.DragAndDrop.dragged_node) {
    e.preventDefault();
    
    //replace Placeholder with Dragged
    var dragged = this.DragAndDrop.dragged_node;
    var saved_parent = this.DragAndDrop.saved.parent;
    saved_parent.replaceChild(dragged, this.DragAndDrop.placeholder);

    //restore saved styles
    myUtils.Object_AppendFrom(dragged.style, this.DragAndDrop.saved.style);

    //var saved_style = this.DragAndDrop.saved.style;
    //var keys = Object.keys();
    //var k;
    //for (var i = 0; i < keys.length; i++) {
    //  k = keys[i];
    //  [k] = saved_style[k];
    //}

    dragged.classList.remove('dragged');
    this.DragAndDrop.dragged_node = null;
    
    //restore focus
    this.DragAndDrop.saved.focus.focus();
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//utils 

MapWithMarkerListClass.prototype.Dragged_setPos = function (dragged, e) {
  var pos = myUtils.xy_add(this.MouseEvent_getPos(e), this.DragAndDrop.initial_offset);
  myUtils.Element_styleTopLeft_from_xy(dragged, pos);
  //myUtils.Element_styleTopLeft_from_xy(dragged, this.MouseEvent_getPos(e));
};
MapWithMarkerListClass.prototype.MouseEvent_getPos = function (e) {
  return {x: e.pageX, y: e.pageY};//relative to document?
  //return {x: e.clientX, y: e.clientY};//relative to window
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//prevent some default behaviors
//this Not prevents text selection by mouse

MapWithMarkerListClass.prototype.draggable_onClick = function (e) {
  this.log('draggable_onClick');
  e.preventDefault();
  return false;
};
MapWithMarkerListClass.prototype.draggable_onDblClick = function (e) {
  this.log('draggable_onDblClick');
  e.preventDefault();
  return false;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//DnD native. prevent it

MapWithMarkerListClass.prototype.draggable_onDragstart = function (e) {
  e.preventDefault();
  return false;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//DnD for target

MapWithMarkerListClass.prototype.droppable_onMouseMove = function (e) {
  //this.log('droppable_onMouseMove');
  
  //isTrusted checked beacuse payload events will be non-truted
  if (this.DragAndDrop.dragged_node && !e.isTrusted) {
    //! important to stop propagation to avoid this event to be sent to document mousemove handler
    //this Will lead to infinite recusive events
    //alternative is to cancel any synthetic events in the document mousemove handler
    e.stopPropagation();
    e.stopImmediatePropagation();//not sure this is neceassary
    
    e.preventDefault();
    var dragged = this.DragAndDrop.dragged_node;
    var item_moved_over = e.target;
    var placeholder = this.DragAndDrop.placeholder;
    
    if (item_moved_over != placeholder) {
    
      //--- detect at which half of item_moved_over the mouse is
      //.offsetTop is Wrong choice 
      //it returns Y _relative_ to the closest offsetParent while e.clientY relative to the window
      var parent = item_moved_over.parentNode;
      var height = item_moved_over.offsetHeight;
      var target_rect = item_moved_over.getBoundingClientRect();
      var placeholder_relY = placeholder.offsetTop - item_moved_over.offsetTop;
      var placeholder_place = placeholder_relY < 0 ? 'before' : 'after';

      var placement;
      if (
        e.clientX >= target_rect.left && e.clientX <= target_rect.right && 
        e.clientY >= target_rect.top && e.clientY <= target_rect.bottom
      ) {
        var relY = e.clientY - target_rect.top;
        placement = (relY < height / 2) ? 'before' : 'after';
      }

      if (placement) {
        //this.log('placement['+placement +'] placeholder_place['+placeholder_place +']');

        if (placement != placeholder_place) {
        
          //переместить placeholder перед\после item_moved_over
          parent.removeChild(placeholder);
          if (placement == 'before') {
            parent.insertBefore(placeholder, item_moved_over);
          } else {
            var sibling = item_moved_over.nextSibling;
            if (sibling) {
              parent.insertBefore(placeholder, sibling);
            } else {
              parent.appendChild(placeholder);
            }
          }
          
        }
      }

      //--- detect mouse enter\leave
      //var item_moved_over_old = this.DragAndDrop.item_moved_over_moved_over;
      //if (item_moved_over != item_moved_over_old) {
      //  if (item_moved_over_old) {
      //    item_moved_over_old.style.backgroundColor = '';
      //  }
      //  this.DragAndDrop.item_moved_over_moved_over = item_moved_over;
      //  item_moved_over.style.backgroundColor = 'violet';
      //}
    }
  }
};

//-----------------------------------------------------------------------------
//Maps powered by LeafLet
//-----------------------------------------------------------------------------
/*
подключена ли библиотека карт?
*/
MapWithMarkerListClass.prototype.MapExists = function () {
  return (window.L ? true : false);
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
/*
добавить маркер на карту
marker - внутреннее представление маркера = элемент this.address_list
*/
MapWithMarkerListClass.prototype.MarkerAddToMap = function (marker) {
  if (this.MapExists()) {

    //var m = markerLabelled([marker.lat, marker.lng], {label: marker.label});//custom Label
    //var m = markerLabelled([marker.lat, marker.lng], {title: marker.label});//custom title - will become a tooltip. Works

    //var m = L.marker([marker.lat, marker.lng]);//default icon. Works
    //var m = L.marker([marker.lat, marker.lng], {icon: myTestIcon});//custom icon. Works
    var m = L.marker([marker.lat, marker.lng], {icon: this.icons_pool[marker.label]});//custom icon pool. Works
    
    m.bindTooltip(String(marker.title), {}).openTooltip();//tooltip = address
    //m.bindTooltip(String(marker.label), {permanent: true}).openTooltip();//just permanent tooltip
    //m.bindTooltip(String(marker.label), {offset: [-30, 0], direction: 'right', permanent: true}).openTooltip();//force direction and offset
    m.bindPopup(marker.title);
    m.addTo(this.map_obj);

    var lat_lng = new L.LatLng(marker.lat, marker.lng); 
    //this.map_obj.setView(lat_lng, 20);//very zoomed. streets are clearly visible
    //this.map_obj.setView(lat_lng, 5);//medium zoom. nearby cities are visible
    this.map_obj.setView(lat_lng, this.marker_add_zoom_default);//medium zoom. nearby cities are visible
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
/*
добавить все маркеры на карту
marker - внутреннее представление маркера = элемент this.address_list
*/
MapWithMarkerListClass.prototype.MarkerListToMap = function () {
  if (this.MapExists()) {
    var marker;
    for (var i = 0; i < this.address_list.length; i++) {
      this.MarkerAddToMap(this.address_list[i]);
    }
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

MapWithMarkerListClass.prototype.MapCreate = function (map_id) {
  this.log('-----MapCreate');
  if (this.MapExists()) {
    this.map_obj = new L.Map(map_id);

    L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
      maxZoom: 18
    }).addTo(this.map_obj);
    this.map_obj.attributionControl.setPrefix(''); // Don't show the 'Powered by Leaflet' text.

    var london = new L.LatLng(51.5056,-0.1213); 
    var moscow = new L.LatLng(55.755814,37.617635); 
    
    this.map_obj.setView(moscow, 13);//без этой строки карта пустая
    
    this.log('-----finished ok');
  } else {
    document.getElementById(map_id).innerHTML("карта недоступна");
  }
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

MapWithMarkerListClass.prototype.IconsPoolCreate = function () {
  //this.log_enabled = true;
  
  this.icons_pool = [];
  var icon_cls = myMapIconClass;
  var suffix;
  
  //var formatter = new Intl.NumberFormat('en-US', {style: 'decimal', minimumIntegerDigits: 2});

  for (var i = 0; i <= 99; i++) {
    suffix = i;
    //suffix = formatter.format(i);
    //this.log(suffix);

    this.icons_pool.push(new myMapIconClass({
      iconUrl: icon_cls.file_name_base + suffix + icon_cls.file_name_ext,
      iconRetinaUrl: icon_cls.file_name_base_retina + suffix + icon_cls.file_name_ext
    }));
  }
  
};

//var myTestIcon = new myMapIconClass();

//var greenIcon = new myMapIconClass({iconUrl: 'leaf-green.png'});
//var redIcon = new myMapIconClass({iconUrl: 'leaf-red.png'});
//var orangeIcon = new myMapIconClass({iconUrl: 'leaf-orange.png'});
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

MapWithMarkerListClass.prototype._static_properties_init = function () {
  this.log('MapWithMarkerListClass._static_properties_init');
  
  //constants related to suggestions HTML 
  var dnd = this.C.DragAndDrop = {};
  dnd.target_over_classes = ['drag-target-over-before', 'drag-target-over-after'];
  
};

//-----------------------------------------------------------------------------
/*
для отладки. добавить несколько маркеров
*/

MapWithMarkerListClass.prototype.test_AddSeveralMarkers = function () {
  myUtils.Element_Clear(this.address_list_html);

  this.MarkerAddFromLatLng(51.5006728, -0.1244324, "Big Ben");
  this.MarkerAddFromLatLng(51.503308, -0.119623, "London Eye");
  this.MarkerAddFromLatLng(51.5077286, -0.1279688, "Nelson's Column");
  //this.MarkerAddFromLatLng(51.5077286, -0.1279688, "Nelson's Column<br><a href=\"https://en.wikipedia.org/wiki/Nelson's_Column\">wp</a>");
};

MapWithMarkerListClass.prototype.test_AddSeveralMarkersB = function () {
  myUtils.Element_Clear(this.address_list_html);
  
  this.MarkerAddFromAddress('микрорайон Сходня, Химки, Московская область, Россия');
  this.MarkerAddFromAddress('Долгопрудный, Московская область, Россия');
  this.MarkerAddFromAddress('район Чертаново Северное, Южный административный округ, Москва, Россия');
  this.MarkerAddFromAddress('Реутов, Московская область, Россия');
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//=============================================================================
