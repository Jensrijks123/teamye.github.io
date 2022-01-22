import { Conversion } from "../model/Conversion";
import { Course } from "../model/Course";
import { Exam } from "../model/Exam";
import { ConversionService } from "../service/ConversionService";
import { CourseService } from "../service/CourseService";
import { ExamService } from "../service/ExamService";

/* each sheet has circa the same structure, see sheet 1 for the explanation. */
export function generateTableSheet9(data, KeyListOfConversions, tblBody, tblHead, toClass) {
    const examService = new ExamService();
    const courseService = new CourseService();
    const conversionService = new ConversionService();
   /* if statement so the page will get the right element*/
   let shadowPage = null
   let shadowTableInfo = null
   let shadowModal = null
   if (document.querySelector('student-page') == null) {
       shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
       shadowTableInfo = shadowPage.querySelector('course-info-cursus').shadowRoot;
       shadowModal = shadowTableInfo.querySelector('course-modal-cursus');
   } else {
       shadowPage = document.querySelector('student-page').shadowRoot;
       shadowTableInfo = shadowPage.querySelector('course-info-student').shadowRoot;
       shadowModal = shadowTableInfo.querySelector('course-modal-student');
   }

    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(0).innerHTML = "Oude code";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(1).innerHTML = "Opleiding";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(2).innerHTML = "Oude naam";
    data.forEach((element, index) => {
        if (index !== 0 && index != 1){
            let row = document.createElement("tr");
            let listOfAttributes = [];        
            let oldName;
            let oldCode ;
            let toetsOld ;
            let ecToetsOld;
            let wegingOld ;
            let bezemOrConversion;
            let newCode;
            let newName;
            let toetsNew;
            let ecToetsNew;
            let ecCursusOld;
            let ecCursusNew;
            let periode;
            let coordinator;
            let wegingNew;
            let opleiding;
            let opmerking;
            let cell;
            let cellText;

            for (let indexOfAttribute = 0; indexOfAttribute < 17; indexOfAttribute++) {
                if (toClass || KeyListOfConversions[indexOfAttribute] === "Versie update" || KeyListOfConversions[indexOfAttribute] === "6/18/21" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY" || KeyListOfConversions[indexOfAttribute] === "__EMPTY_5" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY_6" || KeyListOfConversions[indexOfAttribute] === "__EMPTY_7" 
                || KeyListOfConversions[indexOfAttribute] === "__EMPTY_12"){
                    
                    cell = document.createElement("td");

                    if (!(KeyListOfConversions[indexOfAttribute] in element)){
                        element[KeyListOfConversions[indexOfAttribute]] = data[index-1][KeyListOfConversions[indexOfAttribute]];
                    }
                    if(KeyListOfConversions[indexOfAttribute] === "__EMPTY_6"){
                        cellText = document.createElement("a");  
                        cellText.innerHTML=`<a class="external" href=https://hu.osiris-student.nl/#/inschrijven/cursus/:id target=_blank>${element[KeyListOfConversions[indexOfAttribute]]} ⧉</a>`  
                    } else {
                        cellText = document.createTextNode(element[KeyListOfConversions[indexOfAttribute]]);
                    } 
                        switch (indexOfAttribute) {
                            case 0:
                                oldCode = cellText;
                                break;
                            case 1:
                                opleiding = cellText;
                                break;
                            case 2:
                                oldName = cellText;
                                break;
                            case 3:
                                ecCursusOld = cellText;
                                break;
                            case 4:
                                toetsOld = cellText;
                                break;
                            case 5:
                                wegingOld = cellText;
                                break;
                            case 6:
                                ecToetsOld = cellText;
                                break;
                            case 7:
                                bezemOrConversion = cellText;
                                break;
                            case 8:
                                newCode = cellText;
                                break;
                            case 9:
                                newName = cellText;
                                break;
                            case 10:
                                ecCursusNew = cellText;
                                break;
                            case 11:
                                toetsNew = cellText;
                                break;
                            case 12:
                                wegingNew = cellText;
                                break;
                            case 13:
                                ecToetsNew = cellText;
                                break;
                            case 14:
                                periode = cellText;
                                break;
                            case 15:
                                coordinator = cellText;
                                break;
                            case 16:
                                opmerking = cellText;
                                break;
                        
                    }
                    cell.appendChild(cellText);
                    row.appendChild(cell);
                }
                listOfAttributes.push(element[KeyListOfConversions[indexOfAttribute]]);
            }
            if (toClass && index > 1){
                const oldExam = new Exam(toetsOld.data, wegingOld.data, ecToetsOld.data, coordinator.data);
                const newExam = new Exam(toetsNew.data, wegingNew.data, ecToetsNew.data, coordinator.data);
                examService.saveExam(oldExam);
                examService.saveExam(newExam);
                const oldCourse = new Course(opleiding.data, oldCode.data, oldName.data, periode.data, ecCursusOld.data, oldExam);
                const newCourse = new Course(opleiding.data, newCode.text, newName.data, periode.data, ecCursusNew.data, newExam);
                courseService.saveCourse(oldCourse);
                courseService.saveCourse(newCourse);
                const conversion = new Conversion(bezemOrConversion.data, oldCourse, newCourse, opmerking.data, "sheet9");
                conversionService.saveConversion(conversion);
            }
            row.addEventListener("click", () => shadowModal.createAndOpenModal(listOfAttributes, data[1], KeyListOfConversions));
            row.tabIndex= 0;
            tblBody.appendChild(row);
        }
    });
}