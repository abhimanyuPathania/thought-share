
import re
import datetime

GROUP_NAME_RE = re.compile(r"^[a-zA-Z0-9\s]{3,20}$")
DISPLAY_NAME_RE = re.compile(r"^[a-zA-Z0-9\s]{2,20}$")
SECONDS_IN_DAY = 24*60*60

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
