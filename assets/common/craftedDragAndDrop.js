'use strict';
//=============================================================================
/*
crafted DragAndDrop.
vanilla JavaScript
*/
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function CraftedDragAndDropClass(options) {
  //this.C = this.constructor;
  this.C = CraftedDragAndDropClass;//less elegant alternative in case pre-ES6 browsers don't support constructor
  this.SuperClass.static_properties_init.call(this);//can be called only in a special way
  
  this.DragAndDrop = {
    initial: {
      offset: {x: 0, y: 0},
    },
    current: {
      dragged: null,
      placeholder: null,
    },
    saved: {
      focus: null,
      parent: null,
      style: null,
      nextSibling: null
    },
    droppable_moved_over: null, //используется для определения входа\выхода мыши из droppable
    touch: {
      //id used, not ref-to-object 
      //ref-to-object Might be non-reliable because touch objects re-created in some browsers
      tracked_id: null
    }
  };

  //--- the following handlers must be assigned to the whole page
  //{passive: false} requred to be able to call preventDefault
  //  without passive: false preventDefault will be ignored:
  //  Ignoring ‘preventDefault()’ call on event of type ‘touchmove’ from a listener registered as ‘passive’.
  
  document.addEventListener('mousemove', this.document_onMouseMove.bind(this));
  document.addEventListener('touchmove', this.document_onTouchMove.bind(this), {passive: false});

  document.addEventListener('mouseup', this.document_onMouseUp.bind(this));
  document.addEventListener('touchend', this.document_onTouchEnd.bind(this), {passive: false});
  document.addEventListener('touchcancel', this.document_onTouchCancel.bind(this), {passive: false});
  
  this.DroppableAll_addEventListeners();
  
  //-- External interface
  //will be nice to employ a built-in Listeners mechanism
  //to be able to have multiple listeners
  this.onDragstart = null;
  this.onDragend = null;
  this.onDrop = null;
  
}

CraftedDragAndDropClass.prototype = new GenericBaseClass();//inherit from
CraftedDragAndDropClass.prototype.SuperClass = GenericBaseClass.prototype;

//-----------------------------------------------------------------------------
// External interface
//-----------------------------------------------------------------------------

CraftedDragAndDropClass.prototype.Element_markDraggable = function (elem) {
  this.log_heading3('Element_markDraggable');
  
  elem.dataset.craftedDragAndDrop = 'draggable';
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//droppable elements should be marked in HTML
//example
//<ul data-crafted-drag-and-drop="droppable">

CraftedDragAndDropClass.prototype.DroppableAll_addEventListeners = function () {
  this.log_heading2('DroppableAll_addEventListeners');
  
  var droppable_list = document.querySelectorAll('*[data-crafted-drag-and-drop="droppable"]');
  
  for (var i = 0; i < droppable_list.length; i++) {
    var droppable = droppable_list[i];
    this.log('Droppable addEventListeners to['+droppable.tagName+']');
  
    //--- the following handlers might be assigned to 
    //either the Draggable-Items-List element (preferred) or Draggable-Item element or the whole-page 
    //
    //{passive: false} requred to be able to call preventDefault
    //  without passive: false preventDefault will be ignored:
    //  Ignoring ‘preventDefault()’ call on event of type ‘touchmove’ from a listener registered as ‘passive’.
    
    droppable.addEventListener('mousedown', this.draggable_onMouseDown.bind(this));
    droppable.addEventListener('touchstart', this.draggable_onTouchStart.bind(this), {passive: false});
    
    //--- the following handlers might be assigned to 
    //either the Draggable-Items-List element (preferred) or Draggable-Item element 
    //to prevent some default behaviors

    //DnD native. draggable. prevent it
    droppable.addEventListener('dragstart', this.draggable_onDragstart.bind(this));
    //prevent some default behaviors
    droppable.addEventListener('click', this.draggable_onClick.bind(this));
    droppable.addEventListener('dblclick', this.draggable_onDblClick.bind(this));
    droppable.addEventListener('contextmenu', this.draggable_onContextMenu.bind(this));
  }
};

//-----------------------------------------------------------------------------
//crafted DragAndDrop.
//-----------------------------------------------------------------------------
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

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//Drag Start
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

CraftedDragAndDropClass.prototype.draggable_onMouseDown = function (e) {
  this.log_heading1('draggable_onMouseDown');
  if (e.button == myUtilsClass.mouse.button.main) {
    var dragged = this.getDraggable(e.target);
    if (dragged) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();//not sure this is neceassary
      this.onDragStart(e, dragged);
    }
  }
};

CraftedDragAndDropClass.prototype.onDragStart = function (e, dragged) {
  this.log_heading2('crafted_DnD_onDragStart');
  
  //lose focus, if any. focus IS interfer with DnD
  var dnd = this.DragAndDrop;
  dnd.saved.focus = myUtils.Document_Blur();
  
  //save a ref to the Dragged
  dnd.current.dragged = dragged;
  var parent = dnd.saved.parent = dragged.parentNode;
  dnd.saved.nextSibling = dragged.nextSibling;
  //save the current inline style props, if any
  this.Dragged_saveStyles(dragged);
  
  //call the callback
  if (this.onDragstart) {
    this.onDragstart(dnd.saved.parent, dnd.current.dragged);
  }
  
  //read the curent Dragged style. this is useful to 
  //+ copy styles to a placeholder
  //+ to set fixed WH so WH will not be affected by a new parent
  var dragged_style = window.getComputedStyle(dragged);
  dragged.style.width = dragged_style.width;
  dragged.style.height = dragged_style.height;

  //latch the initial offset between mouse and TL corner. 
  //this helps avoid Dragged to "jump" on the start-drag
  var rect = dragged.getBoundingClientRect();
  this.DragAndDrop.initial.offset = myUtils.xy_subtract(
    {x: rect.left, y: rect.top}, {x: e.clientX, y: e.clientY}
  );
  
  //create a placeholder
  var placeholder = dnd.current.placeholder = document.createElement('li');
  placeholder.classList.add('placeholder');
  placeholder.style.height = dragged_style.height;
  
  //replace Dragged with Placeholder and attach Dragged to the whole Document
  var new_parent = document.body;
  parent.replaceChild(placeholder, dragged);
  new_parent.appendChild(dragged);

  //set some inline styles
  dragged.style.position = 'absolute';
  this.Dragged_setPos(dragged, e);

  dragged.classList.add('dragged');
  
  //this.log('this.DragAndDrop.current.dragged['+this.DragAndDrop.current.dragged+']');
  //this.log('this.DragAndDrop.saved.parent['+this.DragAndDrop.saved.parent+']');
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Move
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

CraftedDragAndDropClass.prototype.document_onMouseMove = function (e) {
  this.log_heading1('document_onMouseMove');
  //! important to check isTrusted. this prevents infinite recursion 
  //because synthetic 'mousemove' event is created in this handler
  if (this.isDragging() && e.isTrusted) {
    e.preventDefault();
    this.onDragMove(e);
  }
};

//closest native method named 'DragOver' but it has different meaning
CraftedDragAndDropClass.prototype.onDragMove = function (e) {
  //this.log_heading2('crafted_DnD_onDragMove');//!uncomment this only for debug
  
  var dnd = this.DragAndDrop;

  //e.preventDefault();//this must be done outside because this can't be done for synthetic evt
    
  var dragged = dnd.current.dragged;
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
      bubbles:  true,
      target:   below,

      screenX:  e.screenX,
      screenY:  e.screenY, 
      clientX:  x, 
      clientY:  y, 
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
    
    //Abanodoned
    //var synth_event = new MouseEvent('mousemove', mouseEventInit);
    //below.dispatchEvent(synth_event);
    
    //прямой вызов без dispatch
    this.Droppable_onDragOver(mouseEventInit);
  }
  dragged.hidden = false;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Drag End - Drop or Cancel
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

CraftedDragAndDropClass.prototype.document_onMouseUp = function (e) {
  this.log_heading1('document_onMouseUp');
  if (this.isDragging()) {
    e.preventDefault();
    this.onDragEnd(e);
  }
};

//created specially to call from touchCancel
CraftedDragAndDropClass.prototype.onDragCancel = function (e) {
  if (this.isDragging()) {
    e.preventDefault();
    this.onDragEnd(e, true);
  }
};

//several native methods exists 'DragEnd' 'Drop' etc
CraftedDragAndDropClass.prototype.onDragEnd = function (e, is_cancelled) {
  this.log_heading2('crafted_DnD_onDragEnd');
  var dnd = this.DragAndDrop;

  //e.preventDefault();//this must be done outside because this can't be done for synthetic evt
  
  if (is_cancelled) {
    //move placeholder to the original position where Drag was started
    dnd.saved.parent.insertBefore(dnd.current.placeholder, dnd.saved.nextSibling);
  }
  
  //actually Drop = replace Placeholder with Dragged
  var dragged = dnd.current.dragged;
  dnd.saved.parent.replaceChild(dragged, dnd.current.placeholder);

  //restore saved styles
  this.Dragged_restoreStyles(dragged);
  
  dragged.classList.remove('dragged');
  dnd.current.dragged = null;
  
  //требование заказчика
  //отключить восстановление фокуса (как минимум для смартфонов)
  //на десктопе (FireFox) фокус сам восстанавливается
  
  //восстановить фокус
  //dnd.saved.focus.focus();
  
  //do the callback
  //
  //way to check if pos changed:
  //dragged.nextSibling == dnd.saved.nextSibling
  if (this.onDragend) {
    this.onDragend(dnd.saved.parent, dragged);
  }

};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//Utils 
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//this might be used by another technologies for example Touch
//
//-- assumed tree
//<ul droppable>
//  <li draggable>
//    <a exclude>
//      <img "X">
//
//hint: 
//  most likely, target = Item or one of it's children but not Droppable List
//  => then climbing up the nodes tree, both Item and List will can be found

CraftedDragAndDropClass.prototype.getDraggable = function (target) {
  return this.SearchInTree(target, 'draggable_map').item;
};

CraftedDragAndDropClass.prototype.getDroppable = function (target) {
  return this.SearchInTree(target, 'droppable_map');
};

CraftedDragAndDropClass.prototype.SearchInTree = function (target, map_name) {
  var consts = this.C.search_in_tree;
  var found = {parent: null, item: null};

  var level = 0;
  var elem = target;

  //search will break if attr value = 'exclude' encountered at any level
  do {
    var attr_val = elem ? elem.dataset.craftedDragAndDrop : false;
    var status = consts[map_name][attr_val];
    
    if (status == 'found_item') {
      found.item = elem;
    }
    
    if (status == 'found') {
      found.parent = elem;
    } else {
      elem = elem.parentNode;
      level++;
    }
  } while (!(status == 'found' || status == 'break' || level >= consts.depth_max) && elem);
    
  return found;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

//this might be used by another technologies for example Touch
CraftedDragAndDropClass.prototype.isDragging = function (target) {
  return this.DragAndDrop.current.dragged !== null;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

CraftedDragAndDropClass.prototype.Dragged_setPos = function (dragged, e) {
  var pos = myUtils.xy_add(this.MouseEvent_getPos(e), this.DragAndDrop.initial.offset);
  myUtils.Element_styleTopLeft_from_xy(dragged, pos);
};
CraftedDragAndDropClass.prototype.MouseEvent_getPos = function (e) {
  return {x: e.pageX, y: e.pageY};//relative to document?
  //return {x: e.clientX, y: e.clientY};//relative to window
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

//save the current _inline_ style props, if any
CraftedDragAndDropClass.prototype.Dragged_saveStyles = function (dragged) {
  var dnd = this.DragAndDrop;
  var saved_style = dnd.saved.style = {};
  saved_style.position = dragged.style.position;
  saved_style.left = dragged.style.left;
  saved_style.top = dragged.style.top;
  saved_style.width = dragged.style.width;
  saved_style.height = dragged.style.height;
};

CraftedDragAndDropClass.prototype.Dragged_restoreStyles = function (dragged) {
  myUtils.Object_AppendFrom(dragged.style, dnd.saved.style);
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

CraftedDragAndDropClass.prototype.isDroppable = function (target) {
  var attr_val = target ? target.dataset.craftedDragAndDrop : false;
  return (attr_val == 'droppable');
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//Prevent some default behaviors
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//this Not prevents text selection by mouse

CraftedDragAndDropClass.prototype.draggable_onClick = function (e) {
  this.log_heading1('draggable_onClick');
  e.preventDefault();
  return false;
};
CraftedDragAndDropClass.prototype.draggable_onDblClick = function (e) {
  this.log_heading1('draggable_onDblClick');
  e.preventDefault();
  return false;
};
CraftedDragAndDropClass.prototype.draggable_onContextMenu = function (e) {
  this.log_heading1('draggable_onContextMenu');
  e.preventDefault();
  e.stopPropagation();
  return false;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//DnD native. prevent it

CraftedDragAndDropClass.prototype.draggable_onDragstart = function (e) {
  e.preventDefault();
  return false;
};

//-----------------------------------------------------------------------------
//crafted DragAndDrop. for Droppable target
//-----------------------------------------------------------------------------
/*
Abandoned
CraftedDragAndDropClass.prototype.droppable_onMouseMove = function (e) {
  //this.log('droppable_onMouseMove');
  
  //isTrusted checked beacuse payload events will be non-truted
  if (this.DragAndDrop.current.dragged && !e.isTrusted) {
    //! important to stop propagation to avoid this event to be sent to document mousemove handler
    //this Will lead to infinite recusive events
    //alternative is to cancel any synthetic events in the document mousemove handler
    e.stopPropagation();
    e.stopImmediatePropagation();//not sure this is neceassary
    
    e.preventDefault();
    this.Droppable_onDragOver(e);
  }
};
*/

CraftedDragAndDropClass.prototype.Droppable_onDragOver = function (e) {
  var dnd = this.DragAndDrop;
  var dragged = dnd.current.dragged;
  var placeholder = dnd.current.placeholder;
  //this.log_heading2('crafted_DnD_Droppable_onDragOver ');
  
  var droppable = this.getDroppable(e.target);
  if (droppable.parent && droppable.item != placeholder) {
  
    //--- detect at which half of droppable.item the mouse is
    //.offsetTop is Wrong choice 
    //it returns Y _relative_ to the closest offsetParent while e.clientY relative to the window
    var parent = droppable.parent;
    var height = droppable.item.offsetHeight;
    var target_rect = droppable.item.getBoundingClientRect();
    var placeholder_relY = placeholder.offsetTop - droppable.item.offsetTop;
    var placeholder_place = placeholder_relY < 0 ? 'before' : 'after';

    var placement;
    if (
      //убедиться что курсор в пределах эл-та 
      e.clientX >= target_rect.left && e.clientX <= target_rect.right && 
      e.clientY >= target_rect.top && e.clientY <= target_rect.bottom
    ) {
      //принять решение в какой половине эл-та находится курсор
      var relY = e.clientY - target_rect.top;
      placement = (relY < height / 2) ? 'before' : 'after';
    }

    if (placement) {
      //this.log('placement['+placement +'] placeholder_place['+placeholder_place +']');

      if (placement != placeholder_place) {
      
        //переместить placeholder перед\после droppable.item
        parent.removeChild(placeholder);
        if (placement == 'before') {
          parent.insertBefore(placeholder, droppable.item);
        } else {
          //If referenceNode is null, the newNode is inserted at the end of the list of child nodes.
          parent.insertBefore(placeholder, droppable.item.nextSibling);
        }
        
      }
    }

    //Abandoned
    //--- detect mouse enter\leave
    //var droppable.item_old = this.DragAndDrop.droppable.item_moved_over;
    //if (droppable.item != droppable.item_old) {
    //  if (droppable.item_old) {
    //    droppable.item_old.style.backgroundColor = '';
    //  }
    //  this.DragAndDrop.droppable.item_moved_over = droppable.item;
    //  droppable.item.style.backgroundColor = 'violet';
    //}
  }
};

//-----------------------------------------------------------------------------
//crafted DragAndDrop. Touch support
//-----------------------------------------------------------------------------
//используется прямой вызов обработчиков предназначенных для мыши
//с передачей искуственно скомпонованного Event-a напрямую
//без использования dispatchEvent(...), во избежание побочных эффектов

CraftedDragAndDropClass.prototype.draggable_onTouchStart = function (e) {
  this.log_heading1('draggable_onTouchStart');
  //this.TouchEvent_dump(e);
  
  var touches = e.changedTouches;
  if (touches.length) {
    var dragged = this.getDraggable(e.target);
    if (dragged) {
      e.preventDefault();
      //this.log('about to call handler for mouse...');
      this.DragAndDrop.touch.tracked_id = touches[0].identifier;
      this.onDragStart(
        this.TouchEvent_toMouseEvent(e, this.DragAndDrop.touch.tracked_id), 
        dragged
      );
    }
  }
  return false;
};

CraftedDragAndDropClass.prototype.document_onTouchMove = function (e) {
  this.log_heading1('document_onTouchMove');
  //this.TouchEvent_dump(e);
  //=0
  //this.log('tracked_id['+this.DragAndDrop.touch.tracked_id+']');
  //=false
  //this.log('instanceof Number['+(this.DragAndDrop.touch.tracked_id instanceof Number)+']');
  //=number
  //this.log('typeof tracked_id['+(typeof this.DragAndDrop.touch.tracked_id )+']');

  if (myUtils.touch_isIdValid(this.DragAndDrop.touch.tracked_id)) {
    e.preventDefault();
    //this.log('about to call handler for mouse...');
    this.onDragMove(this.TouchEvent_toMouseEvent(e, this.DragAndDrop.touch.tracked_id));
  }
  return false;
};

CraftedDragAndDropClass.prototype.document_onTouchEnd = function (e) {
  this.log_heading1('document_onTouchEnd');
  //this.TouchEvent_dump(e);

  if (myUtils.touch_isIdValid(this.DragAndDrop.touch.tracked_id)) {
    e.preventDefault();
    //this.log('about to call handler for mouse...');
    this.onDragEnd(this.TouchEvent_toMouseEvent(e, this.DragAndDrop.touch.tracked_id));
  }
  this.DragAndDrop.touch.tracked_id = null;
  return false;
};

CraftedDragAndDropClass.prototype.document_onTouchCancel = function (e) {
  this.log_heading1('document_onTouchCancel');
  //this.TouchEvent_dump(e);

  if (myUtils.touch_isIdValid(this.DragAndDrop.touch.tracked_id)) {
    e.preventDefault();
    //this.log('about to call handler for mouse...');
    this.onDragCancel(this.TouchEvent_toMouseEvent(e, this.DragAndDrop.touch.tracked_id));
  }
  this.DragAndDrop.touch.tracked_id = null;
  return false;
};

/*
//---sample touch obj
clientX: 113
​​clientY: 176
​​force: 0
​​identifier: 0
​​pageX: 113
​​pageY: 176
​​radiusX: 1
​​radiusY: 1
​​rotationAngle: 0
​​screenX: 1051
​​screenY: 310
​​target: id="93c6c7590475e6ad865f3bd63e823319" js_draggable="">
​​*/
//this is Not 100% correct implementation
CraftedDragAndDropClass.prototype.TouchEvent_toMouseEvent = function (e, touch_id) {
  var mouse_evt = null;

  //fetch the desired touch obj
  var touches = e.touches;
  var touch;
  for (var i = 0; i < touches.length; i++) {
    if (touches[i].identifier == touch_id) {
      touch = touches[i];
      break;
    }
  }
  //this.log('touch ['+touch+'] touch_id['+touch_id+']');

  //transform touch evt to mouse evt
  if (touch) {
    //this event can be easy dintinguished from native events by .isTrusted = undefined = false
    var mouseEventInit = {
      bubbles: true,
      button: myUtilsClass.mouse.button.main,
      
      target:   e.target,
      currentTarget: e.currentTarget,
      //--poor option for .target
      //the Element on which the touch point started when it was first placed on the surface, 
      //even if the touch point has since moved outside the interactive area of that element 
      //or even been removed from the document.
      //target:   touch.target, 

      screenX:  touch.screenX,
      screenY:  touch.screenY, 
      clientX:  touch.clientX, 
      clientY:  touch.clientY, 
      pageX:    touch.pageX, 
      pageY:    touch.pageY, 
    };
    
    //this.log('mouseEventInit');
    //this.log(mouseEventInit);
    
    //Abanodoned
    //var mouse_evt = new MouseEvent(
    //  myUtilsClass.touch.ToMouseEvent.TypeMap[e.type], 
    //  mouseEventInit
    //);
  }
  //this.log('e.target['+e.target+'] e.currentTarget['+e.currentTarget+']');
  //this.log('mouseEventInit.target['+mouseEventInit.target+'] mouseEventInit.currentTarget['+mouseEventInit.currentTarget+']');

  return mouseEventInit;
  //return mouse_evt;//Abanodoned
};

CraftedDragAndDropClass.prototype.TouchEvent_dump = function (e) {
  this.log('---TouchEvent_dump');
  e.preventDefault();
  this.log('changedTouches.length['+e.changedTouches.length+']');
  this.log(e.changedTouches);
  this.log('targetTouches.length['+e.targetTouches.length+']');
  this.log(e.targetTouches);
  this.log('touches.length['+e.touches.length+']');
  this.log(e.touches);
  this.log('target.id['+e.target.id+'] target.tagName['+e.target.tagName+']');
};

//-----------------------------------------------------------------------------

CraftedDragAndDropClass.prototype._static_properties_init = function () {
  this.log('CraftedDragAndDropClass._static_properties_init');
  
  //search in a DOM tree 
  var search = this.C.search_in_tree = {};
  search.depth_max = 5;
  search.draggable_map = {
    'draggable': 'found',
    'exclude': 'break'
  }
  search.droppable_map = {
    'droppable': 'found',
    'draggable': 'found_item'
  }
  
};

//=============================================================================
