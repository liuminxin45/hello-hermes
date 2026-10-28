// Finite, endpoint-safe movement along a short workshop route.
export function samplePath(points,progress){
  const t=Number.isFinite(progress)?Math.max(0,Math.min(1,progress)):0;
  const distance=t*(points.length-1),segment=Math.min(points.length-2,Math.floor(distance)),weight=distance-segment;
  const a=points[segment],b=points[segment+1];
  return {position:a.map((n,i)=>n+(b[i]-n)*weight),direction:a.map((n,i)=>b[i]-n)};
}
