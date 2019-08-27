'use strict';
//=============================================================================
/*
поле ввода с выпадающим списком предположений

---getAllResponseHeaders() = ... 
cache-control: no-store, no-cache, must-revalidate, post-check=0, pre-check=0
>>>content-type: text/json;charset=UTF-8
expires: Thu, 19 Nov 1981 08:52:00 GMT
pragma: no-cache

*/
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function SearchWithSuggestonsClass(options) {
  //this.C = this.constructor;
  this.C = SearchWithSuggestonsClass;//less elegant alternative in case pre-ES6 browsers don't support constructor
  this.SuperClass.static_properties_init.call(this);//can be called only in a special way
  
  this.back_end = options.back_end;

  //константа. минимальное кол-во символов для которого будет выполнен XHR запрос
  this.length_min = options.length_min || 5;
  //константа. через какое время после последнего введённого символа выполнится XHR запрос
  this.delay_to_xhr_start = options.delay_to_xhr_start || 3000;
  
  //--- ключевой объект на странице. поле ввода 
  this.input_html = document.getElementById(options.input_id);
  this.input_html.focus();
  this.input_html.addEventListener('keydown', this.input_onKeydown.bind(this));
  this.input_html.addEventListener('input', this.input_onInput.bind(this));
  this.input_html.addEventListener('keyup', this.input_onKeyup.bind(this));
  this.input_html.addEventListener('focus', this.input_onFocus.bind(this));
  this.input_html.addEventListener('blur', this.input_onBlur.bind(this));

  //--- ключевой объект на странице. список предположений
  this.suggestion_dropdown_html = document.getElementById(options.suggestion_dropdown_id);
  this.suggestion_list_html = this.suggestion_dropdown_html.querySelector('ul');
  this.suggestion_dropdown_html.addEventListener('click', this.dropdown_onClick.bind(this));
  
  this.suggestion_dropdown_html.addEventListener('mousedown', this.dropdown_onMouseDown.bind(this));
  //this.suggestion_dropdown_html.addEventListener('mouseup', this.dropdown_onMouseUp.bind(this));
  
  //these two handlers are required to hide the current item selected with ArrowUp\Down
  this.suggestion_dropdown_html.addEventListener('mouseenter', this.dropdown_onMouseEnter.bind(this));
  this.suggestion_dropdown_html.addEventListener('mouseleave', this.dropdown_onMouseLeave.bind(this));
  //this.suggestion_dropdown_html.addEventListener('mouseout', this.dropdown_onMouseOut.bind(this));
  
  this.suggestions_set_visible(false);
  //последний выбранный стрелками на клавиатуре эл-т. нужно чтобы восстанавливать hover после мыши
  this.suggestion_selected_with_keys;
  //состояние списка
  //  null - список не валиден
  //  'valid' список валиден. нужно чтобы снова показать список при нажатии клавиш-стрелок не запрашивая его заново
  //  'empty' список пуст. XHR вернул пустой список
  this.suggestions_state = null;
  //самый свежий запрос использованный для получения suggestions
  //используется чтобы выяснить редактировалось ли поле ввода пока выполнялся запрос suggestions
  this.suggestions_query_last = null;
  
  //---run-time vars
  this.timeout;
  
  //---interface for integration with external components
  //state might be 
  //  '' - undefined 
  //  'value_from_suggestion' - value just copied from suggestion list
  //  'manual' - value manually edited
  this.state = '';
  this.onStateChange;//callback
}

SearchWithSuggestonsClass.prototype = new GenericBaseClass();//inherit from
SearchWithSuggestonsClass.prototype.SuperClass = GenericBaseClass.prototype;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//---interface for integration with external components

SearchWithSuggestonsClass.prototype.getValue = function (state) {
  return this.input_html.value;
};

SearchWithSuggestonsClass.prototype._setState = function (state) {
  if (state != this.state) {
    var html = this.input_html;
    var consts = this.C.SuggestionList;
    
    this.state = state;
    
    switch (this.state) {
      case 'value_from_suggestion':
        html.classList.add(consts.value_from_suggestion);
        break;
        
      default:
        html.classList.remove(consts.value_from_suggestion);
    }
    
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }
};

//-----------------------------------------------------------------------------
//search input  HTML element and it's events
//-----------------------------------------------------------------------------
/*
input - event handlers

onKeydown onKeyup handlers receive an arg = KeyboardEvent 

examples
KeyboardEvent.key [ArrowUp]  KeyboardEvent.code [ArrowUp]
KeyboardEvent.key [ ]  KeyboardEvent.code [Space]
KeyboardEvent.key [3]  KeyboardEvent.code [Digit3]
-national char
KeyboardEvent.key [в]  KeyboardEvent.code [KeyD]

key properties
KeyboardEvent.code - code value of the physical key
KeyboardEvent.key - key value 
KeyboardEvent.ctrlKey - a Boolean that is true if the Ctrl key was active when the key event was generated.
KeyboardEvent.shiftKey - a Boolean that is true if the Shift key was active when the key event was generated.


--- typical sequence
<<press space while suggestions list expanded>>
input_onKeydown
value [велик]
input_onInput <<<!!! new unnnecessary XHR request started
value [велик ]
input_onKeyup
value [<copied from suggestion>]

<<focus>>
input_onFocus
value [велика]

<<press backspace>>
input_onKeydown
value [велика]
input_onInput
value [велик]
input_onKeyup
value [велик]

<<lost focus>>
input_onBlur base-classes.js:38:13
value [велик]
*/

//этот обработчик нужен прежде всего для 
//предотвращения модификации строки поиска при нажатии некоторых клавиш например Space
//если список suggestions раскрыт
SearchWithSuggestonsClass.prototype.input_onKeydown = function (e) {
  var evt_consts = myUtilsClass.KeyboardEvent;
  this.log('input_onKeydown key ['+e[evt_consts.key_prop]+']');

  if (this.suggestions_get_navigatable()) {
    this._input_onKeydown(e);
  }
};

SearchWithSuggestonsClass.prototype._input_onKeydown = function (e) {
  var evt_consts = myUtilsClass.KeyboardEvent;
  
  //value before modification
  //this.log('value ['+this.input_html.value+']');
  
  var need_preventDefault = false;
  
  switch (e[evt_consts.key_prop]) {
    case evt_consts.Enter:
    case evt_consts.Space:
    case evt_consts.Escape:
      need_preventDefault = true;
      break;

    //default:
    //  need_preventDefault = false;
  }

  if (need_preventDefault) {
    e.preventDefault();
  }

};

//XHR request will start at certain conditions
SearchWithSuggestonsClass.prototype.input_onInput = function (e) {
  this.log('input_onInput');
  //value after modification
  this.log('value ['+this.input_html.value+']');
  
  this.suggestions_state = null;
  this.suggestions_query_last = this.input_html.value;
  
  this._setState('manual');
  if (this.input_html.value.length >= this.length_min) {
    window.clearTimeout(this.timeout);//Passing an invalid ID to clearTimeout() silently does nothing; no exception is thrown.
    this.timeout = window.setTimeout(
      this.back_end.XHR_Start.bind(
        this.back_end, //bind - only
        this.back_end.AddressSuggestions, 
        {address: this.input_html.value}, 
        this.suggestions_populate.bind(this)
      ),
      this.delay_to_xhr_start
    );
  } else {
    this.suggestions_set_visible(false);
  }
};

//KeyUp is the most useful because it is not a subject of the Auto-repeat
SearchWithSuggestonsClass.prototype.input_onKeyup = function (e) {
  var evt_consts = myUtilsClass.KeyboardEvent;
  this.log('input_onKeyup key ['+e[evt_consts.key_prop]+']');
  
  if (this.suggestions_get_navigatable()) {
    this._input_onKeyup(e);
  }
};

SearchWithSuggestonsClass.prototype._input_onKeyup = function (e) {
  var evt_consts = myUtilsClass.KeyboardEvent;
  
  //value after modification
  //this.log('value ['+this.input_html.value+']');
  
  var list_consts = this.C.SuggestionList;
  var list_html = this.suggestion_list_html;
  var suggestion_selected_new;

  var need_preventDefault = true;

  //Note: don't use Left\Right Arrow keys. these keys have useful default behavior
  switch (e[evt_consts.key_prop]) {
    case evt_consts.ArrowUp:
      suggestion_selected_new = this.suggestion_selected_with_keys ? this.suggestion_selected_with_keys.previousSibling : list_html.childNodes[list_html.childNodes.length - 1];
      this.suggestions_set_visible(true);
      break;
      
    case evt_consts.ArrowDown:
      suggestion_selected_new = this.suggestion_selected_with_keys ? this.suggestion_selected_with_keys.nextSibling : list_html.childNodes[0];
      this.suggestions_set_visible(true);
      break;
      
    case evt_consts.Enter:
    case evt_consts.Space:
      this.suggestion_do_select(this.suggestion_selected_with_keys);
      break;

    //close suggestion list with Esc makes sense only then Input has focus
    //then Input loses focus - suggestion list will be closed anyway in [blur] event handler
    case evt_consts.Escape:
      this.suggestions_set_visible(false);
      break;
      
    default:
      need_preventDefault = false;
  }
  
  if (need_preventDefault) {
    e.preventDefault();
  }
  
  if (suggestion_selected_new && suggestion_selected_new != this.suggestion_selected_with_keys ) {
    this.suggestion_selected_with_keys_set_visible(false);
    this.suggestion_selected_with_keys = suggestion_selected_new;
    this.suggestion_selected_with_keys_set_visible(true);
  }

};

SearchWithSuggestonsClass.prototype.suggestion_selected_with_keys_set_visible = function (visible) {
  myUtils.Element_setAttributeBoolean(
    this.suggestion_selected_with_keys, 
    this.C.SuggestionList.item.hovered_attr, visible
  );
};

SearchWithSuggestonsClass.prototype.KeyEventDump = function (e) {
  this.log('KeyboardEvent.key ['+e.key+']  KeyboardEvent.code ['+e.code+']');
  //this.log('KeyboardEvent.key ['+Number(e.key)+']  KeyboardEvent.code ['+Number(e.code)+']');
  //this.log('KeyboardEvent.key ['+Number(e.key).toString(16)+']  KeyboardEvent.code ['+Number(e.code).toString(16)+']');
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

SearchWithSuggestonsClass.prototype.input_onFocus = function (e) {
  this.log('input_onFocus');
  //this.log('value ['+this.input_html.value+']');
};

SearchWithSuggestonsClass.prototype.input_onBlur = function (e) {
  this.log('input_onBlur');
  //this.log('value ['+this.input_html.value+']');
  if (!this.suggestions_prevent_close) {
    this.suggestions_set_visible(false);
    //this.suggestions_hide_timeout = this.PostToQueueEx(this.suggestions_set_visible.bind(this, false);
  }
};

//-----------------------------------------------------------------------------
//Suggestions list  HTML element and it's events
//-----------------------------------------------------------------------------

//XHR request fulfilled
SearchWithSuggestonsClass.prototype.suggestions_populate = function (address_list) {
  this.log('suggestions_populate');
  
  var consts = this.C.SuggestionList;
  
  this.suggestion_selected_with_keys = null;
  
  //suggestiond Might be not found. in this case an empty array [] returned
  var keys = (typeof address_list == 'object') ? Object.keys(address_list) : null;//IE not support keys for arrays
  if (keys && keys.length) {
    //while XHR request in progress - text might become too short 
    //Or can just be changed from the one what suggestions queried for
    //this is the reason for this check
    if (this.input_html.value.length >= this.length_min && this.suggestions_query_last == this.input_html.value) {
      myUtils.Element_Clear(this.suggestion_list_html);
      
      var k;
      for (var i = 0; i < keys.length; i++) {
        k = keys[i];
        this.suggestions_append(k, 'suggestion', address_list[k][consts.json.suggestion_key]);
      }

      this.suggestions_state = 'valid';
      this.suggestions_set_visible(true);
    } else {
      this.suggestions_state = null;
      this.suggestions_set_visible(false);
    }
    
  } else {
    //if suggestions not found
    myUtils.Element_Clear(this.suggestion_list_html);
    this.suggestions_append('info', 'suggestion', 'ничего не найдено');
    this.suggestions_state = 'empty';
    this.suggestions_set_visible(true);
    //set up auto-hide
    this.timeout = window.setTimeout(this.suggestions_autohide.bind(this),
      consts.delay_autohide
    );
  }
  
};

SearchWithSuggestonsClass.prototype.suggestions_append = function (id, css_class, text) {
  var item;
  item = document.createElement('li');
  item.id = 'suggestion-' + id;
  item.classList.add(css_class);
  item.innerHTML = text;
  this.suggestion_list_html.appendChild(item);
};

SearchWithSuggestonsClass.prototype.suggestions_autohide = function () {
//за время задерки состояние могло измениться. 
//скрыть список только если состояние по прежнему = empty
  if (this.suggestions_state == 'empty') {
    this.suggestions_set_visible(false);
    this.suggestions_state = null;
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 

SearchWithSuggestonsClass.prototype.suggestions_get_navigatable = function () {
  return this.suggestions_get_visible() && this.suggestions_state == 'valid';
};

SearchWithSuggestonsClass.prototype.suggestions_get_visible = function () {
  return this.suggestion_dropdown_html.hasAttribute(this.C.SuggestionList.visible_attr);
};

SearchWithSuggestonsClass.prototype.suggestions_set_visible = function (visible) {
  //suggestions_valid на случай если список делается видимым клавишами-стрелками
  myUtils.Element_setAttributeBoolean(
    this.suggestion_dropdown_html, 
    this.C.SuggestionList.visible_attr, visible && this.suggestions_state !== null
  );
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
/*
--- events sequence then click some element
dropdown_onMousedown 
input_onBlur 
dropdown_onMouseup 
dropdown_onClick
*/

//prevent default behavior of input_onBlur hanlder
SearchWithSuggestonsClass.prototype.dropdown_onMouseDown = function (e) {
  //this.log('dropdown_onMousedown');
  this.suggestions_prevent_close = true;
};

//not used
//SearchWithSuggestonsClass.prototype.dropdown_onMouseUp = function (e) {
  //this.log('dropdown_onMouseup');
//};

SearchWithSuggestonsClass.prototype.dropdown_onMouseEnter = function (e) {
  this.log('dropdown_onMouseEnter');
  
  //hide the hover made with Arrow keys, if any
  this.suggestion_selected_with_keys_set_visible(false);
};

SearchWithSuggestonsClass.prototype.dropdown_onMouseLeave = function (e) {
  this.log('dropdown_onMouseLeave');
  
  //show the hover made with Arrow keys, if any
  this.suggestion_selected_with_keys_set_visible(true);
};

//odd. fired right after MouseEnter and Several times
//SearchWithSuggestonsClass.prototype.dropdown_onMouseOut = function (e) {
//  this.log('dropdown_onMouseOut');
//};

SearchWithSuggestonsClass.prototype.dropdown_onClick = function (e) {
  this.log('dropdown_onClick');
  var consts = this.C.SuggestionList;
  //HTMLLIElement
  //this.log('target class ['+e.target.constructor.name+']');
  //suggestion-6
  //this.log('target.id ['+e.target.id+']');
  //LI
  //this.log('target.tagName ['+e.target.tagName+']');
  
  e.preventDefault();
  
  if (e.target.tagName == consts.item.tag_name) {
    this.suggestion_do_select(e.target);
  }
};

SearchWithSuggestonsClass.prototype.suggestion_do_select = function (suggestion_html) {
  //проверки на случай если выбор сделан нажатием клавиш
  if (suggestion_html && this.suggestions_get_visible()) {
    this.input_html.value = suggestion_html.innerHTML;
    this._setState('value_from_suggestion');
    this.suggestions_prevent_close = false;
    this.suggestions_set_visible(false);
  }
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

SearchWithSuggestonsClass.prototype._static_properties_init = function () {
  this.log('SearchWithSuggestonsClass._static_properties_init');
  
  //constants related to suggestions HTML 
  var lst = this.C.SuggestionList = {json: {}, item: {}};
  lst.value_from_suggestion = 'value-from-suggestion';
  lst.visible_attr = 'data-is-visible';
  lst.item.tag_name = 'LI';
  //lst.item.selected_attr_name = 'selected-option';
  //lst.item.selected_sel = '[' + lst.item.selected_attr_name + ']';
  lst.item.hovered_attr = 'data-is-hovered';
  lst.item.hovered_sel = '[' + lst.item.hovered_attr + ']';
  
  //параметры для разбора JSON
  lst.json.suggestion_key = 'address2';
  
  //
  lst.delay_autohide = 5000;

};

//-----------------------------------------------------------------------------

SearchWithSuggestonsClass.prototype.test_inp_val = function () {
  //this.input_html.value = "Великий Новгород, Россия";
  this.input_html.value = "велика";
};

//=============================================================================
