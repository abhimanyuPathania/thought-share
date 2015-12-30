/* this is not an executable script. It just tracks the models being used
to source/render the overlaying ViewModels */

// the models are as per after JS processing

//========================== FEED MODEL ==========================//
//	@feedPageViewModel
// each post in the feed is built using the following model
/*
	group_id -> group to which the post belongs === current group
	group_name -> name of the group in which it was posted(only used in /view-profile)
	user_id -> id of the user who posted it
	poster_name -> name of the poster
	poster_image -> thumbnail of the poster(constants.FEED_POSTER_IMAGE)
	post -> post content
	post_id -> urlsafe of the actual GroupPost entity
	created -> integer timestamp
	timestampText -> text string created from 'created' integer timestamp

	selfPosted -> extra property on post obj when user posts in group
*/

//========================== USER MODEL ==========================//
// directly replicates the server side model with extra 'id' property
// @feedPageViewModel
/* 
	id -> user's id
	email -> user's email
	display_name -> as set by user
	image_url -> full size image
	thumbnail_url -> thumbnail(constants.FEED_TEXTAREA_USER_IMAGE)
 */

//========================== GROUP MODEL ==========================//
//from json injected in HTML data attribute, to make sammy.js work
// @feedPageViewModel
/* 
	id -> group id
	name ->	group name
	private -> boolean stating group is private or not
	cover_image_url -> thumbnail for group (constants.GROUP_LIST_ITEM_IMAGE)
 */



//========================== GROUP SEARCH MODEL ==========================//
// group search results returned by the server
// @feedPageViewModel
/* 
	name ->	group name
	url -> url leading to that group's landing page
	description -> group description
	image -> thumbnail image(constants.SEARCH_IMAGE)
	descriptionPreview -> shortened preview of description display(constants.GROUP_DESCRIPTION_PREVIEW_CHAR_LIMIT)
 */

//========================== HOT GROUPS MODEL ==========================//
// @feedPageViewModel
/* 
	name -> group name
	url -> group's landing page url
	membersNumber ->number of members
	membersText -> text string number of members
	
	imageURL -> group cover image url
	thumbURL -> group thumbnail(constants.HOT_GROUPS_IMAGE)
 */


//========================== GROUP MODEL ==========================//
// @groupLandingPage
/* 
	id -> group id
	name ->	group name
	private -> boolean stating group is private or not
 */


//========================== GROUP MODEL ==========================//
// @userProfileViewModal
/* 
	id -> group id
	name ->	group name
	description -> group description
	cover_image_url -> thumbnail image(constants.PROFILE_GROUP_IMAGE)
	private_str -> 'Private group' or 'Public group'
	members_str -> '1 member' or 'n members'
	url -> link to the group's landing page
	admin -> true if user is admin of that group
	creator -> true is user created that group
 */

 //========================== FEED MODEL ==========================//
//	@userProfileViewModal
// this does has poster_name and poster_image
/*
	group_id -> group to which the post belongs === current group
	group_name -> name of the group in which it was posted(only used in /view-profile)
	user_id -> id of the user who posted it
	post -> post content
	post_id -> urlsafe of the actual GroupPost entity
	created -> integer timestamp
	timestampText -> text string created from 'created' integer timestamp
*/

//========================== NAVBAR DATA MODEL ==========================//
//	@userProfileViewModal, @navbarModViewModel
// this does has poster_name and poster_image
/*
	displayName -> user display name(observable); 
	email -> user email;
	imageURL -> user image URL;
	imageThumb -> user navbar thumbnail(observable, constants.NAVBAR_USER_IMAGE) 
	firstName -> user first name(pureComputed from dispayName)
	logoutURL -> logout url;
	
*/


//========================== REQUEST MODEL ==========================//
// @requestViewModel
/* 
	group_name -> name of the the group to which request is targeted
	user_name -> display name of requestee
	user_image -> image of requestee
	request_hash -> unique hash identifying the request
	complete -> boolean regarding the request is complete or not(always false)
	request_type -> 'admin' or 'join'
	timestamp -> unix timestamp

	//added client side
	
	text -> textual description of notification
	user_image -> thumbnail sized requestee image(constants.REQUEST_IMAGE || constants.PROFILE_REQUEST_IMAGE)
 */

 

 //========================== REQUEST MODEL ==========================//
 // @userProfileViewModel
/* 
	group_name -> name of the the group to which request is targeted
	user_name -> display name of requestee
	user_image -> thumbnail sized requestee image(constants.PROFILE_REQUEST_IMAGE)
	request_hash -> unique hash identifying the request
	complete -> observable tracking status of request
	request_type -> 'admin' or 'join'
	timestamp -> observable of unix timestamp

	//added client side
	timestampText ->Computed observable tracking text repersentation of timestamp according to client's local time
	text -> textual description of notification (observable)
 */



