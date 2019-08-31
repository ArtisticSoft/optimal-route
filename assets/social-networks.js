'use strict';
//=============================================================================
/*
социальные сети
*/
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function SocialNetworksClass(options) {
  //this.C = this.constructor;
  this.C = SocialNetworksClass;//less elegant alternative in case pre-ES6 browsers don't support constructor
  this.SuperClass.static_properties_init.call(this);//can be called only in a special way
  
  this.list_elm = document.getElementById(options.list_id);
  this.item_tag = options.item_tag;
  this.child_tag = options.child_tag;
  this.attribute_name = options.attribute_name;
}

SocialNetworksClass.prototype = new GenericBaseClass();//inherit from
SocialNetworksClass.prototype.SuperClass = GenericBaseClass.prototype;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

SocialNetworksClass.prototype.LinkToShare_BuildAll = function (link_to_share) {
  this.log('LinkToShare_BuildAll');
  
  if (this.list_elm) {
    var q = this.item_tag;
    q += this.child_tag ? ' ' + this.child_tag  : '';
    var children = this.list_elm.querySelectorAll(q);
  
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var soc_net_name = child.getAttribute(this.attribute_name);
      this.log('soc_net_name['+soc_net_name+']');
      var template = this.C.SocialNetworks[soc_net_name].share_link_template;
      var share_url = template.replace('${link_to_share}', link_to_share);
      this.log('share_url['+share_url+']');
      child.setAttribute('href', share_url);
    }
  }
  
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

SocialNetworksClass.prototype._static_properties_init = function () {
  this.log('SocialNetworksClass._static_properties_init');
  
  var link_to_share = '';
  
  this.C.SocialNetworks = {
    //https://oauth.vk.com/authorize?client_id=-1&redirect_uri=https://vk.com/share.php?url=https://www.youtube.com/watch?v=QLNQamphldQ&feature=share&display=widget
    vkontakte: {title: 'ВКонтакте', icon: 'vkontakte.svg', 
      share_link_template: 'https://oauth.vk.com/authorize?client_id=-1&redirect_uri=https://vk.com/share.php?url=${link_to_share}'
    },

    //https://www.facebook.com/login.php?skip_api_login=1&api_key=87741124305&signed_next=1&next=https://www.facebook.com/v2.10/dialog/share?redirect_uri=https://www.youtube.com/facebook_redirect&display=popup&href=https://www.youtube.com/watch?v=QLNQamphldQ&feature=share&client_id=87741124305&ret=login&cancel_url=https://www.youtube.com/facebook_redirect?error_code=4201&error_message=User+canceled+the+Dialog+flow#_=_&display=popup&locale=sv_SE
    facebook: {title: 'Facebook', icon: 'facebook.svg', 
      share_link_template: 'https://www.facebook.com/login.php?skip_api_login=1&api_key=87741124305&signed_next=1&next=https://www.facebook.com/v2.10/dialog/share?redirect_uri=https://www.youtube.com/facebook_redirect&display=popup&href=${link_to_share}'
    },

    //https://connect.ok.ru/offer?url=https://www.youtube.com/watch?v=QLNQamphldQ&feature=share&title=LUSTGAS PÅ VOLVO 940 (NOS)
    odnoklasniki: {title: 'Одноклассники', icon: 'odnoklasniki.svg', 
      share_link_template: 'https://connect.ok.ru/offer?url=${link_to_share}'
    },
  };
  
};

//=============================================================================