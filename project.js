var sys = require('sys'),
    exec = require('child_process').exec;
var mysql = require('mysql');

var con = mysql.createConnection({
  host: "127.0.0.1",
  user: "PhpUser",
  password: "raspberry",
  database: "AnprAccessControl"
});
    
setInterval(mainLoop, 5000);

function mainLoop() {
	console.log("Attempting to Capture Image from Webcam...");
	//Tell the webcam to take a picture and store it in the webcam directory using capture as the name
	exec('fswebcam -r 640x480 --no-banner --quiet /home/pi/Desktop/anprproject/webcam/capture.jpg', 
		function (error, stdout, stderr) {
			if (error !== null) {
				//Log any execution errors
				console.log('Webcam Execution Error: ' + error);
			}
			else if (stderr != ''){
				//Log any standard errors
				console.log('Webcam Standard Error: ' + stderr);	
			}
			else {
				console.log('Image Captured Successfully from Webcam');
				//Parse the captured image with OpenALPR (using country code: eu) and return the results in json format (the -j switch) 
				exec('alpr -j -c eu /home/pi/Desktop/anprproject/webcam/capture.jpg',
					function (error, stdout, stderr) {
						if (error !== null) {
							//Log any execution errors
							console.log('Parse Execution Error: ' + error);
						}
						else if (stderr != ''){
							//Log any standard errors
							console.log('Parse Standard Error: ' + stderr);			
						}
						else {
							//Create a json object based on the standard alpr output
							var plateOutput = JSON.parse(stdout.toString());	
							//log the response from alpr
							console.log('Output' + stdout.toString());
							if (plateOutput.results.length == 0){
								console.log('No Reg Plates Found in Image');
							}
							else if (plateOutput.results.length == 1){
								console.log('Original Plate: ' + plateOutput.results[0].plate);
								var actualIrishPlate = plateOutput.results[0].plate.replace(/I/g,'1');
								console.log('1 Reg Plate Found in Image: ' + actualIrishPlate);
								con.connect(function(err) {
									if (err) throw err;
									console.log('Connected to MySQL AnprAccessControl Database');
									con.query('SELECT COUNT(*) AS MatchingAllowedRegPlateCount FROM AllowedRegPlates WHERE RegPlate = "' + actualIrishPlate + '"', function (err, result) {
										console.log('Checking if Detected Reg Plate is in AllowedRegPlates Table...');
										if (err) throw err;
										if (result[0].MatchingAllowedRegPlateCount = 0) {
											console.log('Vehicle Reg Plate is not in AllowedRegPlates Table');
										}
										else {
											console.log('Vehicle Reg Plate is in AllowedRegPlates Table');
										}
									});
								});
							}
							else {
								console.log('Too Many Reg Plates Found in Image');
							}
							console.log('Image Processing Time: ' + plateOutput.processing_time_ms);	
						}
					});
			}	
	});
}



	
	
