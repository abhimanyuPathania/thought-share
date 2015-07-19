
import re
import datetime

#!!!!!!!!!!!!!!!!!!!!fix uper limit fot the reg ex, update in feed.js too if changes
GROUP_NAME_RE = re.compile(r"^[a-zA-Z0-9\s]{3,20}$")
DISPLAY_NAME_RE = re.compile(r"^[a-zA-Z0-9\s]{2,20}$")
SECONDS_IN_DAY = 24*60*60

MAX_IMAGE_SIZE_BYTES = 10000000

def check_group_name(name):
	if not GROUP_NAME_RE.match(name):
		raise BadUserInputError('Invalid Group name')
	else:
		return True

def sanitize_group_name(name):
    san_name = re.sub(r'[\s]{2,}', ' ', name).strip(' ')
    return san_name
    
def get_group_id(name):
    id = name.replace(' ', '-').lower()
    return id

def check_display_name(name):
	if name and not DISPLAY_NAME_RE.match(name):
		raise BadUserInputError('Invalid display name')
	san_name = re.sub(r'[\s]{2,}', ' ', name).strip(' ')
	return san_name

def check_uploaded_image(blob_info):
	if 'image' not in blob_info.content_type:
		raise BadImageError('Not an image file')

	if blob_info.size > MAX_IMAGE_SIZE_BYTES:
		raise BadImageError('Image size more than 10MB')


def check_query_string(q):
	if not q or q.isspace() or not GROUP_NAME_RE.match(q):
		return False
	else:
		return True

def process_query_string(q):
	#split at space and get a list
	key_words = q.split()
	query_str_fixed = None

	if (len(key_words) > 1) and (len(key_words) < 5):
		#fix OR
		query_str_fixed = ' OR '.join(key_words)
	else:
		query_str_fixed = ' '.join(key_words)
	return query_str_fixed

def build_suggestions(str):
    suggestions = []
    for word in str.split():
        prefix = ""
        for letter in word:
            prefix += letter
            if len(prefix) >= 3:
                suggestions.append(prefix)
    return ' '.join(suggestions)

def get_post_timestamp(dt):
	now = datetime.datetime.utcnow()
	old = dt

	diff = (now - old)
	diff_seconds = int(diff.total_seconds())

	timestamp = None
	if diff_seconds < SECONDS_IN_DAY:

	    if diff_seconds <= 60:
	    	#if posted less than a minute ago
	    	timestamp = "a moment ago"

	    if diff_seconds > 60 and diff_seconds < 3600:
	    	#if posted less than an hour ago
	    	timestamp = (str(int(diff_seconds/60)) + ' min')

	    if diff_seconds >= 3600:
	    	#if posted less than an 24hrs ago
	    	timestamp = (str(int(diff_seconds/3600)) + ' hr')
	else:
		#posted more than a day before
		if now.year == old.year:
			timestamp = '{dt.day} {dt:%b}'.format(dt= old)
		else:
			#show year only if the post is year or older
			timestamp = '{dt.day} {dt:%b}, {dt:%Y}'.format(dt= old)
	return timestamp
	
################----ERROR CLASSES----################

class BadUserInputError(Exception):
	def __init__(self, value):
		self.value = value
	
	def __str__(self):
		return repr(self.value)

class EntityExistsError(Exception):
	def __init__(self, value):
		self.value = value
	
	def __str__(self):
		return repr(self.value)

class BadImageError(Exception):
	def __init__(self, value):
		self.value = value
	
	def __str__(self):
		return repr(self.value)
