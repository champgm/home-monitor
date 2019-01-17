import lodashIsString from 'lodash.isstring';

export function isBlank(value: string | undefined | null): boolean {
  // assertion undefined, null and '' are all falsey
  return !value || !value.trim();
}

export function isArrayEmpty(arrayObj: any[]): boolean {
  if (isNull(arrayObj) || (arrayObj.constructor === Array && arrayObj.length === 0)) {
    return true;
  }
  if (arrayObj instanceof Array) {
    const value: any = arrayObj.find((element: any) => !isNull(element));
    return isNull(value);
  }
  return false;
}

export function isEmptyObject(obj: any): boolean {
  if (isNull(obj)) {
    return true;
  }
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

export function isNull(obj: any): boolean {
  return obj === null || obj === undefined;
}

export function isString(x: any): boolean {
  return lodashIsString(x);
}

export function isEmptyString(strVal: string): boolean {
  if (isNull(strVal)) {
    return true;
  }
  if (!isString(strVal)) {
    return false;
  }
  const trimmed: string = strVal.trim();
  return trimmed === '';
}

export function notEmpty(object: any): boolean {
  return !isEmpty(object);
}

export function isEmpty(object: any): boolean {
  return isEmptyString(object) ||
    isEmptyObject(object) ||
    isArrayEmpty(object);
}

export function enumerateError(error: any) {
  const errorObject: any = {};
  Object.keys(error).forEach((key) => {
    errorObject[key] = error[key];
  });
  errorObject.message = error.message;
  errorObject.name = error.name;
  errorObject.code = error.code;
  errorObject.signal = error.signal;
  errorObject.stack = getFullErrorStack(error);
  return errorObject;
}

export function getFullErrorStack(error) {
  let errorString = error.toString();
  if (errorString === '[object Object]') {
    errorString = '';
  }
  let result = error.stack || errorString;
  if (error.cause && typeof (error.cause) === 'function') {
    const errorCause = error.cause();
    if (errorCause) {
      result += `\nCaused by: ${getFullErrorStack(errorCause)}`;
    }
  }
  return result;
}
