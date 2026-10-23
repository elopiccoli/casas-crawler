import { normalizeText } from './utils.js';

export function jsonValue(item, column) {
  return String(column || '').split('.').reduce((value, key) => value?.[key], item);
}

// Map only explicitly configured public property columns. In particular,
// bedrooms never stand in for ambientes and location never comes from the office.
export function publicJsonFields(item, source) {
  const columns = source.jsonFields || {};
  const read = field => jsonValue(item, columns[field]);
  const fields = {evidence:{}};
  const put = (field, value, column) => {
    if (value == null || value === '') return;
    fields[field] = normalizeText(Array.isArray(value) ? value.join(' · ') : value);
    fields.evidence[field] = {selector:`public catalog: ${column}`, value:fields[field]};
  };
  for(const field of ['title','address','city','neighborhood','propertyType','operation','summary']) put(field,read(field),columns[field]);
  const rooms=Number(read('rooms'));
  if(rooms>0) put('roomsRaw',String(rooms),columns.rooms);
  if(read('parking')!=null) put('parkingRaw',typeof read('parking')==='boolean' ? read('parking')?'Con cochera':'Sin cochera' : read('parking'),columns.parking);
  if(Number(read('areaM2'))>0) put('areaRaw',`${read('areaM2')} m2 ${source.areaKind || ''}`,columns.areaM2);
  if(read('priceWithheld')===true) fields.priceWithheld=true;
  if(!fields.priceWithheld && Number(read('priceAmount'))>0 && read('currency')) put('priceRaw',`${String(read('currency')).replace(/\/.*$/, '')} ${read('priceAmount')}`,`${columns.currency} + ${columns.priceAmount}`);
  return fields;
}

export function publicJsonUrl(item, source) {
  const id=jsonValue(item,source.jsonFields?.id || 'id');
  if(id==null || id==='') return '';
  return new URL(source.propertyPath.replace('{id}',encodeURIComponent(id)),source.website).href;
}
