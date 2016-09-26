<?php

//  "paps --left-margin 1 top-margin 0 text.txt | ps2pdf -dEPSCrop - text.pdf"
// "pdftk ".$doc." stamp ".$id_anagrafica.".pdf output ".$id_anagrafica.".pdf"

if (isset($_POST['id_anagrafica']) && $_POST['doc'] != '') {
	//

	$doc = $_POST['doc'];
	$id_anagrafica = $_POST['id_anagrafica'];

	$new_filename = $id_anagrafica."-".$doc."";
	$file = "/media/pdf/r/php/pdf/temp/".$new_filename;

	$txt = '/media/pdf/r/php/pdf/temp/'.$id_anagrafica.'.txt';
	exec("rm -rf ".$txt);
	exec("touch ".$txt."; chmod 777 ".$txt);
	exec("echo ".$id_anagrafica." >> ".$txt);
	exec("CHMOD 0777 /media/pdf/r/php/pdf/temp/".$id_anagrafica.".txt");
	exec("paps --left-margin 1 --top-margin 0 /media/pdf/r/php/pdf/temp/".$id_anagrafica.".txt | ps2pdf -dEPSCrop - /media/pdf/r/php/pdf/temp/".$id_anagrafica.".pdf");
	exec("pdftk /media/pdf/r/php/pdf/".$doc." stamp /media/pdf/r/php/pdf/temp/".$id_anagrafica.".pdf output ".$file."");

	// $file = location on filesystem
	// $file_public = location public

	$file_public = 'http://pdf.sprea.it/r/php/pdf/temp/'.$new_filename;
	echo $file_public;
} 

exit();

// paps --left-margin 1 --top-margin 0 /media/pdf/r/php/pdf/temp/2013007173.txt | ps2pdf -dEPSCrop - /media/pdf/r/php/pdf/temp/2013007173.pdf