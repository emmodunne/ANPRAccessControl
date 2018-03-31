var sys = require('sys'),
    exec = require('child_process').exec;


	//now that we have a picture saved, execute parse it with openalpr and return the results as json (the -j switch)
	exec('alpr --motion -c eu -j /dev/video0',
	  function (error, stdout, stderr) {
		//create a json object based on the alpr output
		
		var plateOutput = JSON.parse(stdout.toString());
		
		console.log(plateOutput);
		//log the response from alpr
		console.log('alpr response: ' + stdout.toString());
		
		if (error !== null) {
		  //log any errors
		  console.log('exec error: ' + error);
		}
	});


	
	
