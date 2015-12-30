
import re

## helper_functions
GROUP_NAME_RE = re.compile(r"^[a-zA-Z0-9\s]{3,50}$")
DISPLAY_NAME_RE = re.compile(r"^[a-zA-Z0-9\s]{2,50}$")
SECONDS_IN_DAY = 24*60*60
MAX_IMAGE_SIZE_BYTES = 10000000 #10MB

## helper_operations
NOTF_NAMESPACE = 'notifications'

## helper_operations, models
USERS_NAMESPACE = 'users'

## helper_operations, models
DEFAULT_USER_IMAGE = '../images/defaults/user.png'

## helper_operations, models
DFAULT_GROUP_IMAGE = '../images/defaults/group.png'

## models
GROUP_DESCRIPTION_CHAR_LIMIT = 500

## helper function
MAX_NOTIFICATIONS_FETCHED = 2 # SET TO 15

## models
# page size for the posts cursor query
MAX_POSTS_FETCHED = 2 # SET TO 15 or 20 or 10

## widget_handler
HOT_GROUPS_WIDGET_LIMIT = 5

#-------- IMAGE SIZES FOR NON-KO PAGES (pixels)--------#

# group_landing_page
GROUP_LP_GROUP_THUMB = 60
GROUP_LP_CREATOR_THUMB = 60
GROUP_LP_RECENT_POSTS_THUMB = 50
