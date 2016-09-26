<?php

//  "paps --left-margin 1 top-margin 0 text.txt | ps2pdf -dEPSCrop - text.pdf"
// "pdftk ".$doc." stamp ".$id_anagrafica.".pdf output ".$id_anagrafica.".pdf"

if (isset($_POST['id_anagrafica']) && $_POST['doc'] != '') {
	//

	$doc = $_POST['doc'];
	$id_anagrafica = $_POST['id_anagrafica'];

	$file = "/media/pdf/r/php/pdf/temp/".$id_anagrafica."-".$doc."";

	$txt = '/media/pdf/r/php/pdf/temp/'.$id_anagrafica.'.txt';
	exec("touch ".$txt.'  2>&1');
	echo exec("echo ".$id_anagrafica." >> ".$txt.' 2>&1');

	exec("paps --left-margin 1 top-margin 0 ".$id_anagrafica.".txt | ps2pdf -dEPSCrop - ".$id_anagrafica.".pdf");
	exec("pdftk /media/pdf/r/php/pdf/".$doc." stamp /media/pdf/r/php/pdf/temp/".$id_anagrafica.".pdf output ".$file."");

	// echo $file;
} 

exit();