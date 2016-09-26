<?php

//  "paps --left-margin 1 top-margin 0 text.txt | ps2pdf -dEPSCrop - text.pdf"
// "pdftk ".$doc." stamp ".$id_anagrafica.".pdf output ".$id_anagrafica.".pdf"

if (isset($_POST['id_anagrafica']) && $_POST['doc'] != '') {
	//

	$doc = $_POST['doc'];
	$id_anagrafica = $_POST['id_anagrafica'];

	$file = "/media/pdf/r/php/pdf/temp/".$id_anagrafica."-".$doc."";

	$txt = '/media/pdf/r/php/pdf/temp/'.$id_anagrafica.'.txt';
	exec("rm -rf ".$txt);
	exec("touch ".$txt);
	exec("echo ".$id_anagrafica." >> ".$txt);
	exec("CHMOD 777 ".$id_anagrafica.".txt");
	exec("paps --left-margin 1 top-margin 0 /media/pdf/r/php/pdf/temp/".$id_anagrafica.".txt | ps2pdf -dEPSCrop - /media/pdf/r/php/pdf/temp/".$id_anagrafica.".pdf");
	exec("pdftk /media/pdf/r/php/pdf/".$doc." stamp /media/pdf/r/php/pdf/temp/".$id_anagrafica.".pdf output ".$file."");

	echo $file;
} 

exit();

// paps --left-margin 1 top-margin 0 /media/pdf/r/php/pdf/temp/2013007173.txt | ps2pdf -dEPSCrop - /media/pdf/r/php/pdf/temp/2013007173.pdf