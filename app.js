const EXPRESS = require('express');
const BODYPARSER = require('body-parser');
const PATH = require('path');
const APP = EXPRESS();
const FS = require("fs");
const MONGOJS=require("mongojs")
const UTIL=require("util");
const DB= MONGOJS("nodeApp2"); 
const PORT=9090
const LOG_FILE_NAME="ndeApp2.log"
var menu;


//--Setup menu bar...get menu from db, place in variable for later use
if (!menu) {
    console.log("Getting nav details");
    DB.mainMenu.find({},function(err,menuRS) {
       if(err || ! menuRS) {
         console.log(errs);
         console.log("unable to get details for navigation menu");
       } else {
         menu=menuRS;
         console.log("Menu: ",menu);
       }
    });
}

//Logger middleware
const LOGGER = function(req,res,next) {
      console.log("Logging..."+req);
      next();
};
APP.use(LOGGER);

//Setup static paths
APP.use(EXPRESS.static(PATH.join(__dirname,'public')));

// View engine
APP.set('view engine','ejs');
APP.set('views',PATH.join(__dirname,'views'));


//body parser middleware
APP.use(BODYPARSER.json());
APP.use(BODYPARSER.urlencoded({"extended":false}));


//--Start Routes 

//------- Start GET handlenrs
APP.get('/~~parts', function(req,res) {
   res.render("index",{"title":"Customers"
   });
});

APP.get('/', function(req,res) {
   res.render("index",{"menu":menu });
});

APP.get('/msg', function(req,res) {
   getAndShowData(res,menu,"message","messages","messages");

});

APP.get('/shoes', function(req,res) {
   getAndShowData(res,menu,"shoes","shoes","shoes");

});

//Catch any unhandle routes..Must be last route entry
APP.get('/*', function(req,res) {
    res.render('404page',{"menu":menu});
});



//------- POST Routes
APP.post('/msg',function(req,res) {
    console.log("Message form received");
    var msgId = req.body.msgId;
    var errMsg = "";
    if (msgId) {
       console.log("Request deletion of message with ID",msgId);
       deleteOne("messages",msgId);
    } else {
        var msgText = req.body.msgText.trim();
        var msgEmail =req.body.msgEmail.trim();
        console.log("Adding message.......");
        console.log(req.body.msgText);
        console.log(req.body.msgEmail);
        if (!msgText || !msgEmail) {
           
           errMsg=("Missing required input for saving message: Email:"+msgEmail+" Message:"+msgText);
           logToFile(errMsg);
        } else {
          DB.messages.insert({"msgEmail":msgEmail,"msgText":msgText,"created":new Date,"addedBy":req.ip},function(err,rslt) {
             if (err) {
                console.log("Error inserting message: Text=" + msgText + " Email=" + msgEmail,err);
             } else {
               console.log("Added new message: id is:",rslt._id);
             }
          });
        }
    }
    getAndShowData(res,menu,"message","messages","messages",errMsg);
});

APP.post('/shoes', function(req,res) {
    var errMsg ="";
    var shoeId = req.body.shoeId;
    var actionName = req.body.actionName;

    if(shoeId && actionName !== 'update') {
       logToFile("request action:"+actionName+" on shoe with Id:"+shoeId);
       switch(actionName) {
          case 'delete': 
            logToFile("performing deletion of shoe with Id:"+shoeId);
            deleteOne("shoes",shoeId);
            break;
          case 'update':  
            //logToFile("performing update of shoe with Id:"+shoeId);
            errMsg="Update  action on the Shoes collection is not implemented as yet"
            logToFile(errMsg);
          break;
          default:
              errMsg="Unknown action requested on the Shoes collection: Action:["+actionName+"]"
       }
    } else {
       var brand = req.body.brand.trim();
       var shoeType = req.body.shoeType.trim();
       var heelType = req.body.heelType.trim();

       if(!shoeType || !heelType || !brand) {
          errMsg=("Missing one or more input items trying to add shoe. "
          + " Type:["+shoeType+"]" 
          + " Heel:["+heelType+"]"
          + " Brand:["+brand+"]");
          logToFile(errMsg+" From IP:"+req.ip);
       } else {
         if (actionName === "update") {
            DB.shoes.update({_id:MONGOJS.ObjectId(shoeId)},{$set:{"shoeType":shoeType,"heelType":heelType,"brand":brand,"updated":new Date,"updatedBy":req.ip}},
              function(err,rslt) {
                if(err) {
                  errMsg=("Error updateing shoe with Id:"+shoeId );
                  logToFile(errMsg+" from IP:"+req.ip+"Values:: type:"+shoeType+"  heel:"+heelType+" brand:"+brand);
                }

           })
         } else {
            DB.shoes.insert({"shoetype":shoeType,"heelType":heelType,"brand":brand,"created":new Date,"addedBy":req.ip},
              function(err,rslt) {
                if(err) {
                  errMsg=("Error adding shoe from IP:"+req.ip,shoeType,heelType,brand);
                  logToFiule(errMsg);
                }

           })
         }
       }
    }
    getAndShowData(res,menu,"shoes","shoes","shoes",errMsg);
});

//--
//---- End Routes

//server startup
APP.listen(PORT, function() {
   logToFile("Server started on port:"+PORT); 
})

//--- Functions
function getAndShowData(res,menu,viewName,collectionName,rsltSetName,errMsg) {
   console.log("In getAndShowDate with: view:"+viewName+" colectionName: "+collectionName+" Rslt Name:"+rsltSetName);
   DB.collection(collectionName).find({},function(errs,rsltSet) {
       console.log("Back from getting data from collection: "+collectionName);
       if(errs || ! rsltSet) {
         logToFile(" unable to get contents of "+collectionName + " collection"+(errs));
         errrMsg = errMsg + "<br/> Unable to get contents of collection: "+collectionName;
         res.render(viewName,{"menu":menu,[rsltSetName]:[],"errMsg":errMsg });
       } else {
         res.render(viewName,{"menu":menu,[rsltSetName]:rsltSet,"errMsg":errMsg });
       }
    });
}

function deleteOne(collectionName, docId) {
       DB.collection(collectionName).remove({"_id":MONGOJS.ObjectId(docId)},function(err,rslt) {
            if (err) {
               logToFile("Error deleting from collection: "+collectionName
               + " for Id: "+ docId,err);
            } else {
              console.log("Deleted from:"+collectionName+"for Id:"+docId+" \n: ",rslt);
            }
       });
}

function logToFile(msg) {
    var logMsg;
    if (msg === undefined) msg="";
    logMsg = new Date() +"|"+"|"+msg + "\n";
    console.log(logMsg);
    FS.appendFile(LOG_FILE_NAME,
      logMsg,
      function(err) 
      {
         if (err) { 
             console.log("got error"+err+"\n"+"  Logging text:"+logMsg); 
         }
      }
    );
}

