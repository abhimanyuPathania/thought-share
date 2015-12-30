
define(['jquery', 'constants'], function($, constants){

return {
    
getTimestampText: function (t, ntf){
	
	if (!t) {
		// undefined is passed when ko is rendering UI
		return;
	}
	
	//sent ntf as true to get "ago" appended textTimstamp
	var SECONDS_IN_DAY = 24*60*60;
	var miniMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
					  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

	//set timestamps
	var now = Date.now();
	var old = parseInt(t, 10);

	var dateObjNow = new Date(now);
	var dateObjOld = new Date(old*1000);

	//use seconds diff to generate timestamp strings
	now = Math.floor(now/1000);	//convert into seconds
	var diff = now - old;
	var result,
		temp;

	if (diff < SECONDS_IN_DAY){
		if(diff <= 60){
			result = "just a moment ago";
		}

		if(diff > 60 && diff < 3600){
			temp = Math.floor(diff/60);
			result = temp + " mins";
		}

		if(diff >= 3600){
			temp = Math.floor(diff/3600);
			result = temp + " hrs";
		}

		if(temp === 1) {
			//remove the last 's' for '1 mins' or '1 hrs'
			result = result.substring(0, result.length - 1);
		}

		if(ntf && diff > 60) {
			//prepend with 'ago' for notifications timestamp
			result += " ago";
		}

	} else {
		//get local time here
		if (dateObjNow.getFullYear() === dateObjOld.getFullYear()){
			result = dateObjOld.getDate() + " " + miniMonths[dateObjOld.getMonth()];
		} else {
			result = dateObjOld.getDate() + " " + miniMonths[dateObjOld.getMonth()] + ", " + dateObjOld.getFullYear();
		}
	}
	
	return result;
},

getPostNotificationText: function (n){
	
	var groupUrl = "/group/" + n.group_id;
	var posterNameHTML = "<span class='font-weight-bold'>" + n.poster_name + "</span>";
	var groupNameHTML = "<a class='font-weight-bold' href='" + groupUrl + "'>" + n.group_name + "</a>";
	var context;

	if (n["type"] === "post"){
		context = " posted in ";
	}
	if (n["type"] === "join"){
		context = " has accepted your request to join ";
	}
	if (n["type"] === "admin"){
		context = " has accepted your request for adminship of ";
	}

	return (posterNameHTML + context + groupNameHTML + ".");
},

getRequestText : function(req){
	var context;
	var usernameHTML = "<span class='font-weight-bold'>" + req.user_name + "</span>";
	var groupNameHTML = "<span class='font-weight-bold'>" + req.group_name + "</span>";

	if (req.request_type === "join") {
		context = " wants to join ";
	}
	if (req.request_type === "admin") {
		context = " is requesting adminship of ";
	}

	return (usernameHTML + context + groupNameHTML + ".");
},

getRequestCompleteText: function(req){
	var context;
	var usernameHTML = "<span class='font-weight-bold'>" + req.user_name + "</span>";
	var groupNameHTML = "<span class='font-weight-bold'>" + req.group_name + "</span>";

	if (req.request_type === "join") {
		context = " has joined ";
	}
	if (req.request_type === "admin") {
		context = " is an admin of ";
	}

	return ( "Request accepted. " + usernameHTML + context + groupNameHTML + ".");
},

getImageURL: function(url, size, type){

    var imageRe = /.(jpg|png|jpeg)$/;
    var urlOriginal = url;
	if (!url){
		if (type === "user"){
		    url = constants.DEFAULT_USER_IMAGE;
		}
		if (type === "group"){
		    url = constants.DEFAULT_GROUP_IMAGE;
		}
	}
	
	if (size !== 0){
	    if (urlOriginal){
	        url = url + "=s" + size + "-c";
	    } else{
	        var index = url.search(imageRe);
	        url = url.substring(0,index) + size + url.substring(index);
	    }
	}
	
	return url
},

checkImageFile: function(file){
	// file is FileList object

	var allowedImageType = {
		"image/jpeg":true,
		"image/png": true,
		"image/jpg": true
	};
	var result = {
		ok: true,
		errorStr: null
	};

	if (!allowedImageType.hasOwnProperty(file[0].type)){
		result.ok = false;
		result.errorStr = "Not a valid image";
	}

	if (file[0].size > constants.MAX_IMAGE_SIZE_BYTES) {
		result.ok = false;
		result.errorStr = "Image size cannot be more than 10MB";
	}

	if (file.length > 1) {
		result.ok = false;
		result.errorStr = "Please upload one image";
	}

	return result;
},

getCharLeft: function (desc) {
	var inputLength = desc.length;
	var charLimit = constants.GROUP_DESCRIPTION_CHAR_LIMIT


	return inputLength ? (inputLength + " / " + charLimit) : charLimit; 
},

toggleDropdown : function(element) {
	var dropdownWrappers = $(".dropdown-wrapper");

	if (element.hasClass("show")){
		//hiding; simple remove
		element.removeClass("show");
	} else {
		// showing; hide other dropdowns first it visible
		dropdownWrappers.removeClass("show");

		//show the dropdown we want
		element.addClass("show");
	}
},

showDropdown : function (element) {
	//only used in diplaying search results

	var dropdownWrappers = $(".dropdown-wrapper");
	if (!element.hasClass("show")){
		dropdownWrappers.removeClass("show");
		element.addClass("show");
	}
},

}; //end returned module

}); //end define

