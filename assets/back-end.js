'use strict';
//=============================================================================
/*
BackEnd

minor mis-inforamation: md_address is actually address_md

//NOTE: if site uses HTTPS then BackEnd must use HTTPS too, 
//else XHR requests will be blocked by the Browser (FireFox at least)

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
UPD sept02
Попробуй заменить 

http://testtest01.itlogist.ru/api/v1/90164b0a8effb826cff235a3761b91eb/
testtest01.itlogist.ru/api/v1/90164b0a8effb826cff235a3761b91eb/

На такую строку 

http://testtest01.itlogist.ru/api/v1/all/
testtest01.itlogist.ru/api/v1/all/

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
Подбор адреса - отображаем в списке адресов - address2
Note: может возвращать пустой список = [] - массив а не объект {...} как в случае не-пустого списка

    URL http://testtest01.itlogist.ru/api/v1/90164b0a8effb826cff235a3761b91eb/search_address/
    Пример 
    http://testtest01.itlogist.ru/api/v1/90164b0a8effb826cff235a3761b91eb/search_address/?address=%D0%92%D0%B5%D0%BB%D0%B8%D0%BA%D0%B0%D1%8F%2012
    GET запрос
    Вход: переменная address
    Выход:

    Негативный: {"result":1,"address_list":[]}
    Позитивный:
    {
    "result":1,

    "address_list":{

      "1":{
        "address":"Россия, Новгородская область, Великий Новгород, Софийская сторона, Великая улица, 12 ",
        "address2":"Великая улица, 12, Софийская сторона, Великий Новгород, Новгородская область, Россия"
      },

      "2":{
        "address":"Беларусь, Гродненская область, Гродненский район, Коптёвский сельсовет, агрогородок Коробчицы, Великая улица, 12 ",
        "address2":"Великая улица, 12, агрогородок Коробчицы, Коптёвский сельсовет, Гродненский район, Гродненская область, Беларусь"
      }
    }

}

---kinda ODD case: 
enter
Невский пр 13
select from suggestions
Невский проезд, 13, Саратов, Россия
enter Space, Backspace
BackEnd returns an empty list
  value [Невский проезд, 13, Саратов, Россия]
  {"result":1,"address_list":[]}
  
the same for
Невский проезд, 13, Саратов

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
Геокодинг адреса

    URL http://testtest01.itlogist.ru/api/v1/90164b0a8effb826cff235a3761b91eb/geocode/
    Пример
    http://testtest01.itlogist.ru/api/v1/90164b0a8effb826cff235a3761b91eb/geocode/?address=%D0%A0%D0%BE%D1%81%D1%81%D0%B8%D1%8F,%20%D0%9D%D0%BE%D0%B2%D0%B3%D0%BE%D1%80%D0%BE%D0%B4%D1%81%D0%BA%D0%B0%D1%8F%20%D0%BE%D0%B1%D0%BB%D0%B0%D1%81%D1%82%D1%8C,%20%D0%92%D0%B5%D0%BB%D0%B8%D0%BA%D0%B8%D0%B9%20%D0%9D%D0%BE%D0%B2%D0%B3%D0%BE%D1%80%D0%BE%D0%B4,%20%D0%A1%D0%BE%D1%84%D0%B8%D0%B9%D1%81%D0%BA%D0%B0%D1%8F%20%D1%81%D1%82%D0%BE%D1%80%D0%BE%D0%BD%D0%B0,%20%D0%92%D0%B5%D0%BB%D0%B8%D0%BA%D0%B0%D1%8F%20%D1%83%D0%BB%D0%B8%D1%86%D0%B0,%2012&save
    GET - запрос
    Вход: переменная address и параметр save (смотрим пример выше)
    Выход: 

    Негативный: {"result":0}
    Позитивный:
    {
    "lat":"58.528716",
    "lng":"31.280524",
    "md_address":"dlk23jrd23md3o2dd23dxdw3d2",
    "result":1
    }
    
//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
Поиск оптимального маршрута - distribution_address

  URL http://testtest01.itlogist.ru/api/v1/all/distribution_address/ 
  Пример 
  POST - запрос 
  Вход: переменная address содержит список md_address через запятую 
      UPD sept09: и переменная md_list (если есть)
  Выход: 
  Позитивный:
  {
  "result":1,
  
  "address":{
      "1":"87365a03d2013fd966f90011021fd297",
      "2":"d4abbd70fa959bcbdf39b1185728ec3f",
      "3":"33ca68b2f84e30afcf6768ed9090e6b6"
    },
    
  "md_list":"e7b145c8d01f4ee3f1c65357b60c727d"
  }
  
//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
Изменение порядка маршрута - distribution_hand

  URL http://testtest01.itlogist.ru/api/v1/all/distribution_hand/ 
  Пример
  POST - запрос
  Вход: address содержит список md_address через запятую по порядку, и переменная md_list (если есть)
  Выход:
  Позитивный:
  {
    "result":1,
    "address":{
    "1":"87365a03d2013fd966f90011021fd297",
    "2":"d4abbd70fa959bcbdf39b1185728ec3f",
    "3":"33ca68b2f84e30afcf6768ed9090e6b6"
  },
  "md_list":"e7b145c8d01f4ee3f1c65357b60c727d"

*/
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function BackEndClass() {
  //this.C = this.constructor;
  this.C = BackEndClass;//less elegant alternative in case pre-ES6 browsers don't support constructor
  this.SuperClass.static_properties_init.call(this);//can be called only in a special way
  
  this.onReject = null;//global handler

  //Подбор адреса
  this.AddressSuggestions = {
    name: 'addr_suggestions',
    url: this.C.protocol + '://testtest01.itlogist.ru/api/v1/all/search_address/',
    method: 'GET',
    //список параметров метода. имена параметров берутся отсюда, значения из переданного {...}
    //здесь можно задать значение по умолчанию - для обязательных параметров
    //если Имя не найдено в {...} то значение будет взято отсюда, если оно !== undefined
    //если значение === undefined то параметр необязательный, он будет пропущен если отсутствует в {...}
    params: {address: undefined},
    accept_only_latest: true,
    json_main_key: 'address_list'
  };

  //Геокодинг адреса
  this.AddressGeocode = {
    name: 'addr_geocode',
    url: this.C.protocol + '://testtest01.itlogist.ru/api/v1/all/geocode/',
    method: 'GET',
    params: {address: undefined, save: ''}
  };
  
  //Поиск оптимального маршрута
  //POST - запрос 
  this.DistributionAddress = {
    name: 'distribution_address',
    url: this.C.protocol + '://testtest01.itlogist.ru/api/v1/all/distribution_address/',
    method: 'POST',
    //переменная address содержит список md_address через запятую , и переменная md_list (если есть)
    params: {address: undefined, md_list: undefined}
  };
  
  //Изменение порядка маршрута
  //POST - запрос 
  this.DistributionHand = {
    name: 'distribution_hand',
    url: this.C.protocol + '://testtest01.itlogist.ru/api/v1/all/distribution_hand/',
    method: 'POST',
    //address содержит список md_address через запятую по порядку, и переменная md_list (если есть)
    params: {address: undefined, md_list: undefined}
  };
  
  //пул запросов. дерево. для каждого метода своя ветка с массивом запросов
  this.xhr_pool = {
    addr_suggestions: {list:[], wait_for_idx: null},
    addr_geocode: {list:[]},
    distribution_address: {list:[]},
    distribution_hand: {list:[]}
  };
}

BackEndClass.prototype = new GenericBaseClass();//inherit from
BackEndClass.prototype.SuperClass = GenericBaseClass.prototype;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

BackEndClass.prototype.XHR_Start = function (method, query, on_resolve, on_reject) {
  this.log('XHR_Start. method.name ['+method.name+']');
  
  this.log('query');
  this.log(query);
  
  var pool = this.xhr_pool[method.name];
  
  var xhr_obj = new XHRClass({timeout: this.C.timeout_delay});
  var xhr_idx = pool.list.push(xhr_obj) - 1;
  xhr_obj.handle = {method: method, idx: xhr_idx};
  
  if (method.accept_only_latest) {
    pool.wait_for_idx = xhr_idx;
  }
  
  //xhr_obj.log_enabled = true;
  //XHRClass native callback
  xhr_obj.on_settle = this.XHR_onSettle.bind(this, xhr_obj);
  //bind a custom callbacks to be called from XHR_onSettle
  xhr_obj.on_resolve = on_resolve;
  if (on_reject) {
    xhr_obj.on_reject = on_reject;
  }
  
  var url = new URL(method.url);
  var keys = Object.keys(method.params);
  var k;
  var v;
  for (var i = 0; i < keys.length; i++) {
    k = keys[i];
    v = query[k] ? query[k] : method.params[k];
    if (v !== undefined) {
      url.searchParams.append(k, v);
    }
  }
  this.log('url.href ['+url.href+']');
  
  //! important to set responseType = match the actual type from server, else Will be troubles
  xhr_obj.OpenAndSend({method: method.method, url: url.href, responseType: 'json'});
  
  return xhr_obj.handle;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 

BackEndClass.prototype.XHR_onSettle = function (xhr_obj, is_fulfilled) {
  this.log('XHR_onSettle. is_fulfilled ['+is_fulfilled+']');
  
  //the flag to call XHR_onReject
  //will =false then calling on_resolve
  var rq_reject = true;
  
  //vars might be used then calling XHR_onReject
  var json_obj;
  
  if (is_fulfilled) {
    var xhr = xhr_obj.xhr;
    
    var handle = xhr_obj.handle;
    var pool = this.xhr_pool[handle.method.name];
    
    //-- get JSON 
    if (!pool.wait_for_idx || (pool.wait_for_idx == handle.idx)) {
      //usual responseType = json, response class = Object
      var resp_typ = xhr.responseType;
      //=json
      //this.log('responseType ['+resp_typ +']');
      switch (resp_typ) {
        case '':
        case 'text':
          //responseText is only available if responseType is '' or 'text'
          //this.log('----- raw response dump');
          //this.log(xhr.responseText);
          
          try {
            json_obj = JSON.parse(xhr.responseText);
            //json_obj = JSON.parse(decodeURIComponent(xhr.responseText));
            //json_obj = JSON.parse(unescape(xhr.responseText));
          } catch (err) {
            this.log('JSON.parse error: ['+err+']');
            json_obj = null;
          }
          break;
          
        case 'json':
          json_obj = xhr.response;
          //this.log('----- response dump');
          //this.log(xhr.response);
          break;

        default:
          this.log('unsupported responseType ['+xhr.responseType+']');
      }
      
      //-- delete the XHR object from pool
      pool.list.splice(handle.idx, 1);
      
      //-- process the JSON
      if (json_obj && json_obj.result == 1) {
      
        this.log('XHR result = success. pool.list.length ['+pool.list.length+']');
        //this.log(json_obj);
        
        if (handle.method.json_main_key) {
          json_obj = json_obj[handle.method.json_main_key];
        }
        xhr_obj.on_resolve(json_obj);
        rq_reject = false;
      }
    }
  }
  
  if (rq_reject) {
    this.XHR_onReject(xhr_obj, is_fulfilled, json_obj);
  }
};

BackEndClass.prototype.XHR_onReject = function (xhr_obj, is_fulfilled, json) {
  this.log('XHR rejected. is_fulfilled['+is_fulfilled+']');
  
  this.XHR_debug_onRejectDump(xhr_obj, is_fulfilled, json);
  
  //custom callback for this request
  if (xhr_obj.on_reject) {
    xhr_obj.on_reject();
  }

  //global callback
  if (this.onReject) {
    this.onReject(xhr_obj, is_fulfilled, json);
  }
};

BackEndClass.prototype.XHR_debug_onRejectDump = function (xhr_obj, is_fulfilled, json) {
  console.log('XHR_debug_onRejectDump. is_fulfilled['+is_fulfilled+']');
  
  var xhr = xhr_obj.xhr;
  var handle = xhr_obj.handle;
  var pool = this.xhr_pool[handle.method.name];
  
  if (is_fulfilled) {
    this.log('json');
    this.log(json);

    //this.log('response dump...');
    //this.log(xhr.response);

  } else {

    this.log('method.name['+handle.method.name+']');
    this.log('_load_end_conditon_name['+xhr._load_end_conditon_name+']');
  }
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

BackEndClass.prototype.LinkToShareFromJson = function (json) {
  this.log('LinkToShareFromJson');

  var consts = this.C.link_to_share;
  var page_uid = json[consts.json_field];
  this.log('page_uid['+page_uid +']');
  var link;

  //sample page_uid 
  //
  //"md_list": "2t6iyc3"
  //obsolete style = "e7b145c8d01f4ee3f1c65357b60c727d"
  
  if (page_uid && page_uid.length) {
    var url = new URL(this.C.protocol + consts.url);
    url.searchParams.append(consts.query_param, page_uid);
    this.log('url.href ['+url.href+']');
    link = url.href;
  }
  
  return link;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

BackEndClass.prototype._static_properties_init = function () {
  this.log('BackEndClass._static_properties_init');
  
  this.C.protocol = 'https';
  
  this.C.timeout_delay = 10000;
    
  /*
  -= ссылка чтобы поделиться =-
  
  3) md_list берем из метода «Поиск оптимального маршрута - distribution_address» 
  4) домен - пока созать констату с таким заничением «http://testtest01.itlogist.ru/api/v1/all/route_md_list/?md_list=»

  По итогу будет что-то типа этого
  http://testtest01.itlogist.ru/api/v1/all/route_md_list/?md_list=msdof9w4jcos9ecso9e
  */
  var share = this.C.link_to_share = {};
  share.json_field = 'md_list';
  share.url = '://testtest01.itlogist.ru/api/v1/all/route_md_list/';
  share.query_param = 'md_list';
};

//=============================================================================
