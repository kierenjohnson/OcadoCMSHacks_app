// dates for comparison later - how to refresh these?
var today;
var dayAfterTom;
var tomorrow;
var yesterday;
var dayBeforeYesterday;

function refreshDates() {
  var now = new Date();
  today = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  var temp = new Date();
  dayAfterTom = new Date(temp.getFullYear(), temp.getMonth(), temp.getDate());
  tomorrow = new Date(temp.getFullYear(), temp.getMonth(), temp.getDate());
  yesterday = new Date(temp.getFullYear(), temp.getMonth(), temp.getDate());
  dayBeforeYesterday = new Date(temp.getFullYear(), temp.getMonth(), temp.getDate());

  tomorrow.setDate(today.getDate() + 1);
  dayAfterTom.setDate(today.getDate() + 2);
  yesterday.setDate(today.getDate() - 1);
  dayBeforeYesterday.setDate(today.getDate() - 2);

  // refresh dates every 5 minutes
  setTimeout(refreshDates, 5*60*1000);
}
refreshDates();

// return today's date (no time component)
function getTodayDate() {
  var now = new Date();
  return new Date(now.getFullYear(),now.getMonth(),now.getDate());
}

// returns class to use when displaying CRs
function getActionDateClass(actionDateTimeMilli) {
  var actionDateTime = new Date(actionDateTimeMilli);
  var actionDate = new Date(actionDateTime.getFullYear(),actionDateTime.getMonth(),actionDateTime.getDate());

  if (actionDate.getTime() == today.getTime()) {
    return 'actionToday';
  } else if (actionDate.getTime() == yesterday.getTime()) {
    return 'actionYesterday';
  } else if (actionDate.getTime() == tomorrow.getTime()) {
    return 'actionTomorrow';
  } else if (actionDate.getTime() == dayBeforeYesterday.getTime()) {
    return 'actionDayBeforeYesterday';
  } else if (actionDate.getTime() == dayAfterTom.getTime()) {
    return 'actionDayAfterTomorrow';
  }
}

// utility functions to find stuff from id/username
function getUserByUserName(users, userName) {
  for (i = 0; i < users.length; i++) {
    if (users[i].userName == userName) {
      return users[i];
    }
  }
}

function getById(list, id) {
  for (i = 0; i < list.length; i++) {
    if (list[i].id == id) {
      return list[i];
    }
  }
}