/* this object defines all the constants used across Thought Share */

//Constants ending with 'IMAGE' define image sizes used in px
//Constants ending with 'POLLING' define setTimeouts for Ajax polling in milliseconds

define({
	/*request component*/
	REQUEST_IMAGE: 50,
	REQUEST_POLLING: 45000,

	/*notification component*/
	NOTIFICATION_IMAGE: 50,
	NOTIFICATION_POLLING: 15000,

	/*search component*/
	SEARCH_AJAX_REQUEST_TIMEOUT: 800,

	/*navbar_modular component*/
	NAVBAR_USER_IMAGE: 24,
	LIVE_TIMESTAMPS_TIMEOUT: 30000,
	
	//--- MAX_NOTIFICATIONS_FETCHED in constants.py ---//
	MAX_NOTIFICATIONS_SHOWN:2,

	/*search component*/
	SEARCH_IMAGE: 60,

	/*Feed page*/
	GROUP_LIST_ITEM_IMAGE: 40,
	FEED_POSTER_IMAGE: 60,
	FEED_TEXTAREA_USER_IMAGE: 60,
	HOT_GROUPS_IMAGE: 40,

	/* View Profile Page */
	USER_MAIN_IMAGE: 0,
	USER_MODAL_IMAGE: 60,

	PROFILE_GROUP_IMAGE: 60,
	PROFILE_REQUEST_IMAGE: 60,
	PROFILE_NOTIFICATION_IMAGE: 60,
	//--- PROFILE_USER_THUMB in constants.py ---//
	PROFILE_USER_IMAGE: 60,

	/*helper.js*/
	//--- GROUP_DESCRIPTION_CHAR_LIMIT in constants.py ---//
	GROUP_DESCRIPTION_CHAR_LIMIT:600,
	//--- MAX_IMAGE_SIZE_BYTES in constants.py ---//
	MAX_IMAGE_SIZE_BYTES: 10000000,

	/*Regular Expressions*/
	DISPLAY_NAME_REGEX: /^[a-zA-Z0-9\s]{2,50}$/,
	GROUP_NAME_REGEX: /^[a-zA-Z0-9\s]{3,50}$/,

	/*Default Image URLs*/
	//--- DEFAULT_USER_IMAGE, DEFAULT_GROUP_IMAGE in constants.py  ---//
	DEFAULT_USER_IMAGE: "../images/defaults/user.png",
	DEFAULT_GROUP_IMAGE:"../images/defaults/group.png",
});