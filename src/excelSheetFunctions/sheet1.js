import { Conversion } from "../model/Conversion";
import { Course } from "../model/Course";
import { Exam } from "../model/Exam";
import { ConversionService } from "../service/ConversionService";
import { CourseService } from "../service/CourseService";
import { ExamService } from "../service/ExamService";

export function generateTableSheet1(data, KeyListOfConversions, tblBody, tblHead, toClass) {
    /* create the services to save the objects. */
    const examService = new ExamService();
    const courseService = new CourseService();
    const conversionService = new ConversionService();

    /* Show different pages. */

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

    /* change the headers of the table if necessary */
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(0).innerHTML = "Opleiding";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(1).innerHTML = "Oude naam";
    shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(2).innerHTML = "Oude code";
    /* for loop voor every object in the whole sheet. */
    data.forEach((element, index) => {

        /* delete the wrong lines in the excel file. */
        if (index !== 0 && index != 1 && index !== 19 && index !== 20 && index !== 21){
            /* create a row for every line. */
            let row = document.createElement("tr");
            let cell = document.createElement("td");
            let cellText = document.createTextNode("BM");

            /* this attribute isn't in the excel file, but it should be there, so we have to add it separately. */
            if (index !== 1){
                const cell = document.createElement("td");
                const cellText = document.createTextNode("BM");
                cell.appendChild(cellText);
                row.appendChild(cell);
            }
            let listOfAttributes = [];        
            let oldName;
            let oldCode ;
            let ecCursusOld;
            let toetsOld ;
            let ecToetsOld;
            let wegingOld ;
            let bezemOrConversion;
            let newCode;
            let newName;
            let ecCursusNew;
            let toetsNew;
            let ecToetsNew;
            let periode;
            let coordinator;
            let opmerking;
            let wegingNew;
 
            /* for loop for the object's attributes. */
            for (let indexOfAttribute = 0; indexOfAttribute < 16; indexOfAttribute++) {
                /* filter the data to show in the table. */
                if (toClass || KeyListOfConversions[indexOfAttribute] === "Versie update" || KeyListOfConversions[indexOfAttribute] === "9/6/21" ||
                 KeyListOfConversions[indexOfAttribute] === "__EMPTY_6" || KeyListOfConversions[indexOfAttribute] === "__EMPTY_5" ||
                  KeyListOfConversions[indexOfAttribute] === "__EMPTY_11" || KeyListOfConversions[indexOfAttribute] === "__EMPTY_4"){
                    /* create the right header words. */

                    cell = document.createElement("td");
                    if (!(KeyListOfConversions[indexOfAttribute] in element)){
                        element[KeyListOfConversions[indexOfAttribute]] = data[index-1][KeyListOfConversions[indexOfAttribute]];
                    }
                    if(KeyListOfConversions[indexOfAttribute] === "__EMPTY_5"){
                        cellText = document.createElement("a");  
                        cellText.innerHTML=
                        `<a class="external" href=https://hu.osiris-student.nl/#/inschrijven/cursus/:id target=_blank>${element[KeyListOfConversions[indexOfAttribute]]} ⧉</a>`  
                    } else {
                        cellText = document.createTextNode(element[KeyListOfConversions[indexOfAttribute]]);
                    }
                    
                    /* to create the objects in the sessionstorage. */
                    switch (indexOfAttribute) {
                        case 0:
                            oldName = cellText;
                            break;
                        case 1:
                            oldCode = cellText;
                            break;
                        case 2:
                            ecCursusOld = cellText;
                            break;
                        case 3:
                            toetsOld = cellText;
                            break;
                        case 4:
                            wegingOld = cellText;
                            break;
                        case 5:
                            ecToetsOld = cellText;
                            break;
                        case 6:
                            bezemOrConversion = cellText;
                            break;
                        case 7: 
                            newCode =  cellText;                                      
                            break;
                        case 8:
                            newName = cellText;
                            break;
                        case 9:
                            ecCursusNew = cellText;
                            break;
                        case 10:
                            toetsNew = cellText;
                            break;
                        case 11:
                            wegingNew = cellText;
                            break;
                        case 12:
                            ecToetsNew = cellText;
                            break;
                        case 13:
                            periode = cellText;
                            break;
                        case 14:
                            coordinator = cellText;
                            break;
                        case 15:
                            opmerking = cellText;
                            break;                    
                    }

                    
                    cell.appendChild(cellText);
                    row.appendChild(cell);
                }
                listOfAttributes.push(element[KeyListOfConversions[indexOfAttribute]]);
            }
            /* create the objects for the session storage. */
            if (toClass && index > 1){ 
                const oldExam = new Exam(toetsOld.data, wegingOld.data, ecToetsOld.data, coordinator.data);
                const newExam = new Exam(toetsNew.data, wegingNew.data, ecToetsNew.data, coordinator.data);
                examService.saveExam(oldExam);
                examService.saveExam(newExam);
                const oldCourse = new Course("BM", oldCode.data, oldName.data, periode.data, ecCursusOld.data, oldExam);
                const newCourse = new Course("BM", newCode.text, newName.data, periode.data, ecCursusNew.data, newExam);
                courseService.saveCourse(oldCourse);
                courseService.saveCourse(newCourse);
                if (opmerking.data === "undefined"){
                    opmerking.data = "";
                }
                const conversion = new Conversion(bezemOrConversion.data, oldCourse, newCourse, opmerking.data, "sheet1");
                conversionService.saveConversion(conversion);
            }

            /* fil the combobox with the options to search. */
            row.addEventListener("click", () => 
            shadowModal.createAndOpenModal(listOfAttributes, data[1], KeyListOfConversions));
            tblBody.appendChild(row); 
        }
    });
}