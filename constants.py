
import re

## helper_functions
#!!!!!!!!!!!!!!!!!!!!fix uper limit fot the reg ex, update in feed.js too if changes
GROUP_NAME_RE = re.compile(r"^[a-zA-Z0-9\s]{3,20}$")
DISPLAY_NAME_RE = re.compile(r"^[a-zA-Z0-9\s]{2,20}$")
SECONDS_IN_DAY = 24*60*60
MAX_IMAGE_SIZE_BYTES = 10000000

## helper_operations
NOTF_NAMESPACE = 'notifications'

## helper_operations, models
USERS_NAMESPACE = 'users'

## helper_operations, models
DEFAULT_USER_AVATAR = '../images/defaults/user.png'

## helper_operations, models
DFAULT_GROUP_IMAGE = '../images/defaults/group.png'

## models
THUMBNAIL_SIZE = 100