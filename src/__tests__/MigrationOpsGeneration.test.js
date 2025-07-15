import { migrateAnnotations } from '../utils/migrateAnnotations';

describe('migrationOps explicit handling', ()=>{
  const pdfData={f1:{annotations:[{id:'a1',objectName:'Car',objectVersion:1,humanRevised:true,values:{brand:'VW',year:2020},pageIndex:0}]}};
  const oldObj={name:'Car',version:1,fields:[{name:'brand',type:'string'},{name:'year',type:'number'}]};
  it('applies rename and delete ops',()=>{
    const newObj={name:'Car',version:2,fields:[{name:'brandName',type:'string'}],migrationOps:[{op:'rename',from:'brand',to:'brandName'},{op:'delete',field:'year'}]};
    const {updatedPdfData}=migrateAnnotations(pdfData,oldObj,newObj);
    const ann=updatedPdfData.f1.annotations[0];
    expect(ann.values).toEqual({brandName:'VW'});
  });
  it('marks type change as pending validation',()=>{
    const newObj={name:'Car',version:2,fields:[{name:'brand',type:'number'},{name:'year',type:'number'}],migrationOps:[{op:'typeChange',field:'brand',from:'string',to:'number'}]};
    const {updatedPdfData}=migrateAnnotations(pdfData,oldObj,newObj);
    expect(updatedPdfData.f1.annotations[0].pendingValidation).toBe(true);
  });
}); 