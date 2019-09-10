//=============================================================================
/*
коллекция функций оформленая как класс
*/
//-----------------------------------------------------------------------------

function myUtilsClass() {
  this.C = myUtilsClass;
}

//константы класса

myUtilsClass.mouse = {
  button: {
    main: 0,//usually the left button or the un-initialized state
    auxiliary: 1,//usually the wheel button or the middle button (if present)
    secondary: 2,//usually the right button
    fourth: 3,//typically the Browser Back button
    fifth: 4//typically the Browser Forward button
  }
};

//KeyboardEvent handling params
//i am not sure this will be the same across all browsers, so this is kinda a shim
myUtilsClass.KeyboardEvent = {
  key_prop: 'code', 
  ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', 
  Space: 'Space', Enter: 'Enter', Escape: 'Escape'
};

myUtilsClass.touch = {
  ToMouseEvent: {
    TypeMap: {
      'touchstart': 'mousedown',
      'touchmove':  'mousemove',
      'touchend':   'mouseup',
      'touchcancel':'mouseup',//!special handing required. where is no direct Mouse analog
    }
  }
};

//-----------------------------------------------------------------------------
//Object. добавить св-ва из другого объекта. одноимённые св-ва будут перезаписаны

myUtilsClass.prototype.Object_AppendFrom = function (obj_to, obj_from) {
  var keys = Object.keys(obj_from);
  var k;
  for (var i = 0; i < keys.length; i++) {
    k = keys[i];
    //console.log('k['+k+'] obj_from[k]['+obj_from[k]+']');
    obj_to[k] = obj_from[k];
  }
};
//-----------------------------------------------------------------------------
//Document. убрать фокус если он есть и вернуть элемент на котором был фокус

myUtilsClass.prototype.Document_Blur = function () {
  var active = document.activeElement;
  if (active) {
    active.blur();
  }
  return active;
};

//-----------------------------------------------------------------------------
//HTML Element. очистить содержимое

myUtilsClass.prototype.Element_Clear = function (element) {
//easy alternative
  element.innerHTML = '';
  
/*
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
  */
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//HTML Element. установить значение 
//boolean атрибута с именем attr. можно передавать массив имён
//атрибут добавляется или удаляется в зависимости от bool
//значение обычно = '' но его можно задать параметром val 

myUtilsClass.prototype.Element_setAttributeBoolean = function (element, attr, bool, val) {
  if (val === undefined) {
    val = '';
    //val = bool ? 'true' : 'false';//this is not necessary
  }
  
  if (element) {
    if (bool) {

      if (attr instanceof Array) {
        for (var i = 0; i < this.attr.length; i++) {
          element.setAttribute(attr[i], val);
        }
      } else {
        element.setAttribute(attr, val);
      }

    } else {

      if (attr instanceof Array) {
        for (var i = 0; i < this.attr.length; i++) {
          element.removeAttribute(attr[i]);
        }
      } else {
        element.removeAttribute(attr);
      }

    }
  }
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//HTML Element. добавить или удалить CSS класс

myUtilsClass.prototype.Element_classList_AddRemove = function (element, class_name, add) {
  if (add) {
    element.classList.add(class_name);
  } else {
    element.classList.remove(class_name);
  }
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//HTML Element. получить смещение относительно документа

myUtilsClass.prototype.Element_offsetRelativeToDocument = function (element) {
  var offset = {x: 0, y: 0};
  while (element)
  {
    console.log('element.constructor.name['+element.constructor.name+']');
    //console.log('element.offsetLeft['+element.offsetLeft+'] offsetTop['+element.offsetTop+']');
    offset.x += element.offsetLeft;
    offset.y += element.offsetTop;
    element = element.offsetParent;
  }
  return offset;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//HTML Element. найти Parent содержаший заданный класс

myUtilsClass.prototype.Element_findParent_hasClass = function (element, class_name, depth_max) {
  var level = 0;
  var prnt = element;
  var is_found;
  do {
    prnt = prnt.parentNode;
    
    //the key line
    is_found = prnt ? prnt.classList.contains(class_name) : false;
    
    level++;
  } while (!(is_found || level >= depth_max) && prnt);
  
  return {parent: prnt, is_found: is_found};
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//HTML Element. найти Parent содержаший заданное значение атрибута data-*
//имена эл-тов должны быть в JS формате, не в HTML формате. 
//например HTML: data-list-size => JS: listSize

myUtilsClass.prototype.Element_findParent_hasDataNameValue = function (element, attr_name, attr_value, depth_max) {
  var level = 0;
  var prnt = element;
  var is_found;
  do {
    prnt = prnt.parentNode;

    //the key line
    is_found = prnt ? (prnt.dataset[attr_name] == attr_value) : false;

    level++;
  } while (!(is_found || level >= depth_max) && prnt);
  
  return {parent: prnt, is_found: is_found};
};

//-----------------------------------------------------------------------------
//HTML Element. рестарт анимации. удалить CSS класс и добавить его после задержки

myUtilsClass.prototype.Element_animation_start = function (element, class_name, delay) {
  //console.log('Element_animation_start element['+element+']');
  //console.log(element);
  
  delay = delay || 0;
  if (element && class_name) {
    //Removing a class that does not exist does NOT throw an error.
    element.classList.remove(class_name);
    
    window.setTimeout(this.classList_add.bind(this, element, class_name), delay);

    if (true) {
      var animation_stop_callback = this.classList_remove.bind(this, element, class_name);
      element.addEventListener('animationend', animation_stop_callback);
      //this Not helps then element is dragged while animation still in progress
      element.addEventListener('onanimationcancel', animation_stop_callback);
    }
  }
};

myUtilsClass.prototype.classList_add = function (element, class_name) {
  console.log('classList_add');
  element.classList.add(class_name);
};

myUtilsClass.prototype.classList_remove = function (element, class_name) {
  console.log('classList_remove');
  //console.log('classList_remove  element['+element+'] class_name['+class_name+']');
  element.classList.remove(class_name);
};

/*
Wierd! 
element = [item-active-anim]
for Raw fun
function classList_add_raw(element, class_name) {
  console.log('element['+element+']');
  element.classList.add(class_name);
}
*/

//-----------------------------------------------------------------------------
//Node. получить соседний эл-т по индексу

myUtilsClass.prototype.Node_getSiblingByIdx = function (node, idx) {
  return (idx == 0) ? target.previousSibling : target.nextSibling;
};

//-----------------------------------------------------------------------------

myUtilsClass.prototype.touch_isIdValid = function (id) {
  var invalid_types = ['null', 'boolean', 'object'];
  return !(id === undefined || id === null || invalid_types.indexOf(typeof id) >= 0);
};

//-----------------------------------------------------------------------------
//координаты = любой объект со св-вами x и y

myUtilsClass.prototype.xy_copy = function (xy_a, xy_b) {
  xy_a.x = xy_b.x;
  xy_a.y = xy_b.y;
};

myUtilsClass.prototype.xy_add = function (xy_a, xy_b) {
  xy = {x: 0, y: 0};
  xy.x = xy_a.x + xy_b.x;
  xy.y = xy_a.y + xy_b.y;
  return xy;
};

myUtilsClass.prototype.xy_subtract = function (xy_a, xy_b) {
  xy = {x: 0, y: 0};
  xy.x = xy_a.x - xy_b.x;
  xy.y = xy_a.y - xy_b.y;
  return xy;
};

myUtilsClass.prototype.Element_styleTopLeft_from_xy = function (element, xy) {
  element.style.left = xy.x + 'px';
  element.style.top = xy.y + 'px';
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

var myUtils = new myUtilsClass();

//=============================================================================
